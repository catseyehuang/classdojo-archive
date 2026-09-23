import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Inbox, Archive, Calendar as CalendarIcon, ClipboardList, Users, Database, Settings, X, Loader2, RefreshCw, BrainCircuit, ArrowLeft, CheckCircle2, AlertCircle, LogOut, User as UserIcon } from 'lucide-react';
import Calendar from './components/Calendar';
import PostCard from './components/PostCard';
import SmartSummary from './components/SmartSummary';
import AuthGate from './components/AuthGate';
import { supabase } from './supabaseClient';
import './index.css';

export default function App() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('All');
  const [selectedTeacher, setSelectedTeacher] = useState('All');
  const [selectedDate, setSelectedDate] = useState(null); // YYYY-MM-DD

  // Auth & Whitelist states (POV-37)
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState('');

  // Settings states (Gemini API Key 優先讀取環境變數 VITE_GEMINI_API_KEY，亦可於介面自訂並暫存 localStorage)
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('dojo_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '');
  const [syncStatus, setSyncStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [syncError, setSyncError] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState('feed'); // 'filter' | 'feed' | 'summary'
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const handleSaveSettings = () => {
    localStorage.setItem('dojo_gemini_api_key', geminiApiKey);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 2000);
  };

  // 自 Supabase PostgreSQL 資料表 dojo_posts 分頁分批讀取全量貼文 (突破 PostgREST 1000 限制)
  const fetchPostsFromSupabase = useCallback(async () => {
    setLoading(true);
    setSyncStatus('loading');
    setSyncError('');

    try {
      const allPosts = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('dojo_posts')
          .select('*')
          .order('created_at_taiwan', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) {
          throw error;
        }

        if (Array.isArray(data) && data.length > 0) {
          allPosts.push(...data);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            from += pageSize;
          }
        } else {
          hasMore = false;
        }
      }

      setPosts(allPosts);
      setSyncStatus('success');
    } catch (err) {
      console.error('Supabase 載入錯誤:', err);
      setSyncStatus('error');
      setSyncError(err.message || '無法連線至 Supabase 資料庫');
    } finally {
      setLoading(false);
    }
  }, []);

  // 白名單校驗
  const verifyUserWhitelist = useCallback(async (currentUser) => {
    if (!currentUser || !currentUser.email) {
      setIsAuthorized(false);
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('authorized_users')
        .select('email, name, role')
        .eq('email', currentUser.email)
        .maybeSingle();

      if (error || !data) {
        setIsAuthorized(false);
        setAuthError(`帳號 ${currentUser.email} 尚未加入允許名單。`);
        return false;
      }

      setIsAuthorized(true);
      setAuthError('');
      return true;
    } catch (err) {
      console.error('白名單驗證失敗:', err);
      setIsAuthorized(false);
      setAuthError('白名單驗證發生錯誤');
      return false;
    }
  }, []);

  // 登入與 Auth 狀態監聽
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        if (mounted) {
          setUser(currentUser);
          if (currentUser) {
            const ok = await verifyUserWhitelist(currentUser);
            if (ok) {
              fetchPostsFromSupabase();
            }
          }
        }
      } catch (err) {
        console.error('Auth 初始化失敗:', err);
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const ok = await verifyUserWhitelist(currentUser);
        if (ok) {
          fetchPostsFromSupabase();
        }
      } else {
        setIsAuthorized(false);
        setPosts([]);
      }
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [verifyUserWhitelist, fetchPostsFromSupabase]);

  // Google 登入處理
  const handleSignInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname
        }
      });
      if (error) throw error;
    } catch (err) {
      alert('Google 登入失敗: ' + (err.message || err));
    }
  };

  // 登出處理
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setIsAuthorized(false);
      setPosts([]);
    } catch (err) {
      console.error('登出失敗:', err);
    }
  };


  // 計算每個年級的原始總文章數與動態年級清單
  const { gradeCounts, availableGrades } = useMemo(() => {
    const counts = { 'All': posts.length };
    const gradesSet = new Set();

    posts.forEach(post => {
      if (post.grade) {
        counts[post.grade] = (counts[post.grade] || 0) + 1;
        gradesSet.add(post.grade);
      }
    });

    const sortedGrades = Array.from(gradesSet).sort((a, b) => b.localeCompare(a));
    return {
      gradeCounts: counts,
      availableGrades: [
        { key: 'All', label: '所有年級' },
        ...sortedGrades.map(g => ({ key: g, label: g }))
      ]
    };
  }, [posts]);

  // 計算每個老師的原始文章數與動態教師清單
  const { teacherCounts, availableTeachers } = useMemo(() => {
    const counts = { 'All': posts.length };
    const teacherMap = new Map();

    posts.forEach(post => {
      if (post.author) {
        counts[post.author] = (counts[post.author] || 0) + 1;
        teacherMap.set(post.author, counts[post.author]);
      }
    });

    const sortedTeachers = Array.from(teacherMap.keys()).sort((a, b) => (counts[b] || 0) - (counts[a] || 0));

    return {
      teacherCounts: counts,
      availableTeachers: [
        { key: 'All', label: '所有教師' },
        ...sortedTeachers.map(t => ({ key: t, label: t }))
      ]
    };
  }, [posts]);

  // 多重過濾與全文檢索邏輯
  const filteredPosts = useMemo(() => {
    let result = [...posts];

    // 1. 年級篩選
    if (selectedGrade !== 'All') {
      result = result.filter(post => post.grade === selectedGrade);
    }

    // 2. 教師篩選
    if (selectedTeacher !== 'All') {
      result = result.filter(post => post.author === selectedTeacher);
    }

    // 3. 日期篩選 (台灣時間日期前綴匹配)
    if (selectedDate) {
      result = result.filter(post => {
        if (!post.created_at_taiwan) return false;
        return post.created_at_taiwan.startsWith(selectedDate);
      });
    }

    // 4. 全文檢索 (搜尋內容、作者、班級、翻譯)
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(post => {
        const contentMatch = post.content_raw && post.content_raw.toLowerCase().includes(query);
        const authorMatch = post.author && post.author.toLowerCase().includes(query);
        const classNameMatch = post.class_name && post.class_name.toLowerCase().includes(query);
        const translationMatch = post.translation && post.translation.toLowerCase().includes(query);
        return contentMatch || authorMatch || classNameMatch || translationMatch;
      });
    }

    // 5. 排序 (依台灣時間由新到舊)
    result.sort((a, b) => {
      const timeA = a.created_at_taiwan || '';
      const timeB = b.created_at_taiwan || '';
      return timeB.localeCompare(timeA);
    });

    return result;
  }, [posts, searchQuery, selectedGrade, selectedTeacher, selectedDate]);

  // 一次性讀入全部內容
  const postsToRender = useMemo(() => {
    return filteredPosts;
  }, [filteredPosts]);

  // 若未登入或不在白名單，渲染 AuthGate 守衛
  if (authLoading || !user || !isAuthorized) {
    return (
      <AuthGate
        authLoading={authLoading}
        user={user}
        isAuthorized={isAuthorized}
        authError={authError}
        onSignInWithGoogle={handleSignInWithGoogle}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <div className="app-container">
      {/* 頂部標頭列 - 整合搜尋與同步指示燈 */}
      <header className="app-header">
        {isMobileSearchOpen ? (
          /* 手機版搜尋展開狀態 */
          <div className="mobile-search-overlay" style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '8px' }}>
            <button
              className="search-back-btn"
              onClick={() => {
                setIsMobileSearchOpen(false);
                setSearchQuery('');
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '8px', color: 'var(--text-secondary)' }}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="search-wrapper" style={{ flexGrow: 1, maxWidth: '100%' }}>
              <Search className="search-icon" size={16} />
              <input
                type="text"
                placeholder="搜尋歷史貼文..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        ) : (
          /* 一般狀態 (桌機 & 手機未展開搜尋) */
          <>
            <div className="header-left">
              <div className="header-logo-icon">CD</div>
              <div className="header-title-group">
                <h1 className="header-title">ClassDojo Archive</h1>
                <div className="header-subtitle-container" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="header-subtitle">Jim 班級聯絡簿</span>
                  <span className="mobile-status-dot-wrapper">
                    <span className={`sync-dot ${syncStatus === 'success' ? 'success' : syncStatus === 'error' ? 'error' : 'loading'}`} style={{ width: '6px', height: '6px', boxShadow: 'none' }}></span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {syncStatus === 'success' ? `${posts.length}筆` : syncStatus === 'loading' ? '載入' : '離線'}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* 桌機版搜尋框 (手機版隱藏) */}
            <div className="header-center desktop-search-only">
              <div className="search-wrapper">
                <Search className="search-icon" size={16} />
                <input
                  type="text"
                  placeholder="全文檢索 ClassDojo 歷史紀錄..."
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="搜尋貼文"
                />
              </div>
            </div>

            {/* 雲端同步狀態與設定在右側 */}
            <div className="header-right">
              {/* 桌機版狀態指示器 (手機版隱藏) */}
              <div className="sync-status-indicator desktop-status-only">
                {syncStatus === 'loading' && <Loader2 className="sync-spinner" size={14} />}
                {syncStatus === 'success' && <span className="sync-dot"></span>}
                {syncStatus === 'error' && <span className="sync-dot error"></span>}
                <span className={`sync-status-text ${syncStatus}`}>
                  {syncStatus === 'loading' && 'Supabase 載入中...'}
                  {syncStatus === 'success' && `Supabase 連線 (${posts.length} 筆)`}
                  {syncStatus === 'error' && 'Supabase 連線失敗'}
                </span>
              </div>

              {/* 手機版專屬搜尋切換按鈕 (桌機版隱藏) */}
              <button
                className="mobile-search-toggle"
                onClick={() => setIsMobileSearchOpen(true)}
                title="展開搜尋"
              >
                <Search size={18} />
              </button>

              <button
                className="gdrive-refresh-btn"
                onClick={fetchPostsFromSupabase}
                title="重新整理 Supabase 資料"
                aria-label="重新整理 Supabase 資料"
                disabled={syncStatus === 'loading'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={16} className={syncStatus === 'loading' ? "spinner-animate" : ""} style={{ animation: syncStatus === 'loading' ? 'spin 1s linear infinite' : 'none' }} />
                <span className="desktop-btn-text" style={{ fontSize: '0.85rem' }}>重新整理</span>
              </button>

              <button className="settings-btn" onClick={() => setIsSettingsOpen(true)} title="開啟設定">
                <Settings size={18} />
              </button>

              {/* 使用者 Google 資訊與登出按鈕 */}
              <div className="user-profile-badge" title={`已登入: ${user.email}`}>
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="Avatar" className="user-avatar-img" />
                ) : (
                  <div className="user-avatar-fallback"><UserIcon size={14} /></div>
                )}
                <span className="user-email-text">{user.user_metadata?.full_name || user.email}</span>
              </div>

              <button 
                className="sign-out-nav-btn" 
                onClick={handleSignOut} 
                title="登出 Google 帳號"
              >
                <LogOut size={16} />
                <span className="desktop-btn-text">登出</span>
              </button>
            </div>
          </>
        )}
      </header>

      {/* 行動裝置標籤切換列 */}
      <div className="mobile-tabs-bar">
        <button
          className={`mobile-tab-btn ${activeMobileTab === 'filter' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('filter')}
        >
          <Search size={18} />
          <span>時間與篩選</span>
        </button>
        <button
          className={`mobile-tab-btn ${activeMobileTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('feed')}
        >
          <Inbox size={18} />
          <span>歷史貼文 ({filteredPosts.length})</span>
        </button>
        <button
          className={`mobile-tab-btn ${activeMobileTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveMobileTab('summary')}
        >
          <BrainCircuit size={18} />
          <span>智慧總結</span>
        </button>
      </div>

      {/* 主要三欄版面 - 左右整條側塊無氣泡框 */}
      <main className="app-dashboard">

        {/* 左側欄 (22% 寬)：日曆與篩選 */}
        <section className={`sidebar-panel sidebar-left ${activeMobileTab === 'filter' ? 'mobile-show' : 'mobile-hide'}`}>

          {/* 日曆檢視器 */}
          <div className="sidebar-section">
            <h3 className="panel-title">
              <CalendarIcon size={16} style={{ color: 'var(--primary)' }} />
              日曆時間檢視
            </h3>
            <Calendar
              posts={posts}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </div>

          {/* 教師篩選器 */}
          <div className="sidebar-section">
            <h3 className="panel-title">
              <Users size={16} style={{ color: 'var(--primary)' }} />
              發文教師篩選
            </h3>
            <div className="grade-filter-list">
              {availableTeachers.map(tOpt => (
                <button
                  key={tOpt.key}
                  onClick={() => setSelectedTeacher(tOpt.key)}
                  className={`filter-btn ${selectedTeacher === tOpt.key ? 'active' : ''}`}
                >
                  <span>{tOpt.label}</span>
                  <span className="filter-count">{teacherCounts[tOpt.key] || 0}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 年級篩選器 */}
          <div className="sidebar-section">
            <h3 className="panel-title">
              <Archive size={16} style={{ color: 'var(--primary)' }} />
              年級分類篩選
            </h3>
            <div className="select-wrapper">
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="grade-select"
              >
                {availableGrades.map(gradeOpt => (
                  <option key={gradeOpt.key} value={gradeOpt.key}>
                    {gradeOpt.label} ({gradeCounts[gradeOpt.key] || 0})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 雲端同步說明區塊 (貼底放置) */}
          <div className="sync-info-box">
            <div className="sync-info-title">
              <span>⚡ 雲端資料庫狀態：</span>
            </div>
            已直連 Supabase PostgreSQL 資料庫，全量貼文即時檢索與 AI 智慧總結。
          </div>
        </section>

        {/* 中側欄：滾動 Feed 區塊 */}
        <section className={`feed-column ${activeMobileTab === 'feed' ? 'mobile-show' : 'mobile-hide'}`}>
          <div className="feed-title-header">
            <h2 className="feed-title">全部歷史紀錄</h2>
            <span className="feed-count-badge">{filteredPosts.length} 筆</span>
          </div>

          {/* 載入中狀態 */}
          {loading ? (
            <div className="feed-loading-overlay">
              <div className="spinner"></div>
              <span>正在從 Supabase 雲端資料庫載入數據...</span>
            </div>
          ) : postsToRender.length > 0 ? (
            <>
              {postsToRender.map(post => (
                <PostCard key={post.post_id} post={post} />
              ))}
            </>
          ) : (
            // 找不到貼文時的狀態顯示
            <div className="empty-state">
              <Inbox className="empty-state-icon" />
              <h4 className="empty-state-title">找不到相關貼文</h4>
              <p className="empty-state-desc">
                請嘗試更換關鍵字、清除日期篩選，或切換至其他教師/年級進行搜尋。
              </p>
              {(selectedDate || searchQuery || selectedGrade !== 'All' || selectedTeacher !== 'All') && (
                <button
                  className="filter-btn active"
                  style={{ marginTop: '16px', display: 'inline-flex', width: 'auto', gap: '8px' }}
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedGrade('All');
                    setSelectedTeacher('All');
                    setSelectedDate(null);
                  }}
                >
                  重設所有篩選
                </button>
              )}
            </div>
          )}
        </section>

        {/* 右側欄 (30% 寬)：智慧重要總結 */}
        <section className={`sidebar-panel sidebar-right ${activeMobileTab === 'summary' ? 'mobile-show' : 'mobile-hide'}`}>
          <SmartSummary
            filteredPosts={filteredPosts}
            allPosts={posts}
            apiKey={geminiApiKey}
          />
        </section>

      </main>

      {/* 設定面板抽屜 (Slide-out drawer) */}
      <div className={`settings-drawer ${isSettingsOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3 className="drawer-title">
            <Settings size={18} style={{ color: 'var(--primary)' }} />
            工具設定
          </h3>
          <button className="drawer-close" onClick={() => setIsSettingsOpen(false)} aria-label="關閉設定">
            <X size={20} />
          </button>
        </div>
        <div className="drawer-content">
          <div className="settings-field">
            <label className="settings-label">Gemini API Key</label>
            <input
              type="password"
              className="settings-input"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="請輸入 Gemini API Key..."
            />
            <p className="settings-desc">
              用於右側智慧總結與對話。已支援從 <code>.env</code> 的 <code>VITE_GEMINI_API_KEY</code> 自動讀取，亦可於此輸入儲存至瀏覽器。
            </p>
          </div>

          <div className="settings-field">
            <label className="settings-label">Supabase 資料庫連線</label>
            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid #e2e8f0', color: '#475569' }}>
              <div><strong>狀態：</strong> <span style={{ color: syncStatus === 'success' ? '#10b981' : syncStatus === 'loading' ? '#f59e0b' : '#ef4444' }}>{syncStatus === 'success' ? '連線正常' : syncStatus === 'loading' ? '連線中' : '連線失敗'}</span></div>
              <div style={{ marginTop: '4px' }}><strong>資料表：</strong> <code>public.dojo_posts</code></div>
              <div style={{ marginTop: '4px' }}><strong>已載入貼文：</strong> {posts.length} 筆</div>
            </div>
            <p className="settings-desc" style={{ marginTop: '6px' }}>
              系統已全面改接 Supabase 雲端資料庫，原 Google Drive / GAS 相依已完全移除。
            </p>
          </div>

          <button className="settings-save-btn" onClick={handleSaveSettings}>
            儲存設定
          </button>

          {showSaveSuccess && (
            <div className="settings-save-toast">儲存成功！</div>
          )}
        </div>
      </div>

      {/* Drawer Overlay backdrop */}
      {isSettingsOpen && (
        <div className="drawer-backdrop" onClick={() => setIsSettingsOpen(false)}></div>
      )}
    </div>
  );
}
