import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Search, Inbox, Archive, Calendar as CalendarIcon, Users, Settings, X, 
  Loader2, RefreshCw, BrainCircuit, ArrowLeft, Sparkles, Filter, ChevronDown, 
  ChevronUp, Check, ArrowUp
} from 'lucide-react';
import Calendar from './components/Calendar';
import PostCard from './components/PostCard';
import SmartSummary from './components/SmartSummary';
import ImageLightbox from './components/ImageLightbox';
import { 
  getStoredTeacherProfiles, saveTeacherProfiles, PALETTE, TEACHER_THEMES, 
  normalizeName, resolveTeacherTheme 
} from './teacherProfiles';
import { supabase } from './supabaseClient';
import './index.css';

export default function App() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('All');
  const [selectedTeacher, setSelectedTeacher] = useState('All');
  const [selectedDate, setSelectedDate] = useState(null); // YYYY-MM-DD

  // Settings states
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('dojo_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '');
  const [syncStatus, setSyncStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [syncError, setSyncError] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // 教師個性化主題管理 (規格書 7.4)
  const [teacherProfiles, setTeacherProfiles] = useState(() => getStoredTeacherProfiles());

  // 圖片燈箱狀態 (規格書 7.1.4)
  const [lightboxData, setLightboxData] = useState(null); // { images: [], index: 0 }

  // 導覽狀態 (URL Hash 同步: #feed, #calendar, #summary)
  const getInitialTab = () => {
    const hash = window.location.hash.toLowerCase();
    if (hash === '#calendar' || hash === '#filter') return 'calendar';
    if (hash === '#summary' || hash === '#insight') return 'summary';
    return 'feed';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);

  // 頁面捲動位置紀錄（切換分頁時保留捲動位置）
  const scrollPositions = useRef({ feed: 0, calendar: 0, summary: 0 });
  const contentAreaRef = useRef(null);

  // 全螢幕搜尋面板開關
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);

  // 頂部列隨滾動隱藏/顯示狀態
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  // 鍵盤彈起時暫時隱藏底部導覽
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // 教師篩選長名單收合/展開與即時搜尋
  const [isTeacherListExpanded, setIsTeacherListExpanded] = useState(false);
  const [teacherFilterSearch, setTeacherFilterSearch] = useState('');

  // 回到頂部按鈕狀態
  const [showBackToTop, setShowBackToTop] = useState(false);

  // 監聽 URL Hash 變更
  useEffect(() => {
    const handleHashChange = () => {
      const newTab = getInitialTab();
      setActiveTab(newTab);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 切換 Tab 並更新 Hash
  const handleTabChange = (tab) => {
    // 記錄目前分頁的捲動位置
    if (contentAreaRef.current) {
      scrollPositions.current[activeTab] = contentAreaRef.current.scrollTop;
    }
    setActiveTab(tab);
    window.location.hash = `#${tab}`;

    // 還原目標分頁的捲動位置
    setTimeout(() => {
      if (contentAreaRef.current) {
        contentAreaRef.current.scrollTop = scrollPositions.current[tab] || 0;
      }
    }, 50);
  };

  // 監聽虛擬鍵盤彈起 (focusin/focusout)
  useEffect(() => {
    const handleFocusIn = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        setIsKeyboardOpen(true);
      }
    };
    const handleFocusOut = () => {
      setIsKeyboardOpen(false);
    };
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  // 滾動監聽：頂部列隱藏/顯示與回到頂部
  const handleContentScroll = (e) => {
    const currentScrollY = e.currentTarget.scrollTop;
    if (currentScrollY > 120 && currentScrollY > lastScrollY.current + 10) {
      setIsHeaderVisible(false); // 向下捲動隱藏
    } else if (currentScrollY < lastScrollY.current - 10 || currentScrollY <= 60) {
      setIsHeaderVisible(true); // 向上捲動顯示
    }
    setShowBackToTop(currentScrollY > 400);
    lastScrollY.current = currentScrollY;
  };

  // 捲動至頂部
  const scrollToTop = () => {
    if (contentAreaRef.current) {
      contentAreaRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 儲存設定（API Key 與 教師主題）
  const handleSaveSettings = () => {
    localStorage.setItem('dojo_gemini_api_key', geminiApiKey);
    saveTeacherProfiles(teacherProfiles);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 2000);
  };

  // 更新單一教師個性化設定
  const handleUpdateTeacherProfile = (authorName, field, value) => {
    const key = normalizeName(authorName);
    setTeacherProfiles(prev => {
      const updated = {
        ...prev,
        [key]: {
          ...(prev[key] || { displayName: authorName }),
          [field]: value
        }
      };
      saveTeacherProfiles(updated);
      return updated;
    });
  };

  // 自 Supabase PostgreSQL 資料表 dojo_posts 分頁讀取
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

        if (error) throw error;

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

  useEffect(() => {
    fetchPostsFromSupabase();
  }, [fetchPostsFromSupabase]);

  // 動態年級清單
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

  // 動態教師清單
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

  // 過濾貼文
  const filteredPosts = useMemo(() => {
    let result = [...posts];

    if (selectedGrade !== 'All') {
      result = result.filter(post => post.grade === selectedGrade);
    }
    if (selectedTeacher !== 'All') {
      result = result.filter(post => post.author === selectedTeacher);
    }
    if (selectedDate) {
      result = result.filter(post => {
        if (!post.created_at_taiwan) return false;
        return post.created_at_taiwan.startsWith(selectedDate);
      });
    }
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

    result.sort((a, b) => {
      const timeA = a.created_at_taiwan || '';
      const timeB = b.created_at_taiwan || '';
      return timeB.localeCompare(timeA);
    });

    return result;
  }, [posts, searchQuery, selectedGrade, selectedTeacher, selectedDate]);

  // 教師篩選清單（支援前 5 名收合與即時搜尋）
  const displayTeachersList = useMemo(() => {
    let list = availableTeachers;
    if (teacherFilterSearch.trim()) {
      const q = teacherFilterSearch.toLowerCase();
      list = list.filter(t => t.label.toLowerCase().includes(q));
    } else if (!isTeacherListExpanded) {
      list = list.slice(0, 6); // 所有教師 + 前 5 名
    }
    return list;
  }, [availableTeachers, isTeacherListExpanded, teacherFilterSearch]);

  return (
    <div className="app-shell">
      {/* 頂部列（56px，隨向下捲動平滑收起） */}
      <header className={`brand-top-header ${!isHeaderVisible ? 'header-hidden' : ''}`}>
        <div className="header-inner">
          {/* 左側：品牌 Logo 與站名 */}
          <div className="header-brand-group">
            <div className="brand-logo-badge" aria-hidden="true">
              <span>CD</span>
            </div>
            <div className="brand-title-group">
              <h1 className="brand-title">ClassDojo Archive</h1>
              <div className="brand-sub-row">
                <span className="brand-sub">Jim 班級聯絡簿</span>
                <span className="post-count-capsule">
                  <span className="count-number">{posts.length}</span> 篇
                </span>
              </div>
            </div>
          </div>

          {/* 右側：3 個主要圖示按鈕 (搜尋、重整、設定) */}
          <div className="header-action-group">
            <button
              type="button"
              className="icon-touch-btn"
              onClick={() => setIsSearchOverlayOpen(true)}
              title="搜尋貼文"
              aria-label="開啟搜尋"
            >
              <Search size={20} />
            </button>
            <button
              type="button"
              className="icon-touch-btn"
              onClick={fetchPostsFromSupabase}
              title="重新整理貼文"
              aria-label="重新整理貼文"
              disabled={syncStatus === 'loading'}
            >
              <RefreshCw size={20} className={syncStatus === 'loading' ? 'spinner-animate' : ''} />
            </button>
            <button
              type="button"
              className="icon-touch-btn"
              onClick={() => setIsSettingsOpen(true)}
              title="開啟設定"
              aria-label="開啟設定"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* 桌面版側邊導覽列 (≥ 768px 自動啟用) */}
      <aside className="desktop-sidebar-nav" aria-label="桌面側邊導覽">
        <div className="sidebar-brand-top">
          <div className="brand-logo-badge large">
            <span>CD</span>
          </div>
          <div className="brand-title-group">
            <span className="brand-title">ClassDojo</span>
            <span className="brand-sub">歷史封存手帳</span>
          </div>
        </div>

        <nav className="sidebar-nav-menu" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'feed'}
            className={`sidebar-tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => handleTabChange('feed')}
          >
            <Inbox size={20} />
            <span>歷史貼文</span>
            <span className="tab-count-badge">{filteredPosts.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'calendar'}
            className={`sidebar-tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => handleTabChange('calendar')}
          >
            <CalendarIcon size={20} />
            <span>時間與篩選</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'summary'}
            className={`sidebar-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => handleTabChange('summary')}
          >
            <Sparkles size={20} className="gold-icon" />
            <span>智慧總結</span>
          </button>
        </nav>

        <div className="sidebar-bottom-actions">
          <button
            type="button"
            className="sidebar-tool-btn"
            onClick={() => setIsSearchOverlayOpen(true)}
          >
            <Search size={16} />
            <span>全文搜尋</span>
          </button>
          <button
            type="button"
            className="sidebar-tool-btn"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings size={16} />
            <span>教師主題與設定</span>
          </button>
        </div>
      </aside>

      {/* 主要內容容器（單欄置中，包含各 Tab 內容） */}
      <main 
        className="main-scroll-viewport" 
        ref={contentAreaRef}
        onScroll={handleContentScroll}
      >
        <div className="content-container-max">
          {/* TAB 1: 貼文列表 (預設首頁) */}
          {activeTab === 'feed' && (
            <section className="feed-view-tab" aria-label="歷史貼文列表">
              {/* 篩選摘要列 (Sticky Filter Bar) */}
              <div className="filter-summary-bar">
                <div className="filter-summary-left">
                  <h2 className="feed-serif-heading">全部歷史紀錄</h2>
                  <span className="feed-total-pill">{filteredPosts.length} 篇</span>
                </div>

                {/* 已套用之篩選 Chip */}
                {(selectedDate || selectedTeacher !== 'All' || selectedGrade !== 'All' || searchQuery) && (
                  <div className="applied-chips-row">
                    {selectedDate && (
                      <span className="filter-chip">
                        <span>📅 {selectedDate}</span>
                        <button type="button" onClick={() => setSelectedDate(null)} aria-label="移除日期篩選">×</button>
                      </span>
                    )}
                    {selectedTeacher !== 'All' && (
                      <span className="filter-chip teacher-chip">
                        <span>{selectedTeacher}</span>
                        <button type="button" onClick={() => setSelectedTeacher('All')} aria-label="移除教師篩選">×</button>
                      </span>
                    )}
                    {selectedGrade !== 'All' && (
                      <span className="filter-chip">
                        <span>{selectedGrade}</span>
                        <button type="button" onClick={() => setSelectedGrade('All')} aria-label="移除年級篩選">×</button>
                      </span>
                    )}
                    {searchQuery && (
                      <span className="filter-chip">
                        <span>搜尋: {searchQuery}</span>
                        <button type="button" onClick={() => setSearchQuery('')} aria-label="清除搜尋">×</button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 載入中骨架屏 */}
              {loading ? (
                <div className="post-skeleton-list">
                  {[1, 2, 3].map(n => (
                    <div key={n} className="post-card-skeleton">
                      <div className="skeleton-avatar"></div>
                      <div className="skeleton-lines">
                        <div className="skeleton-line-title"></div>
                        <div className="skeleton-line-body"></div>
                        <div className="skeleton-line-body short"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredPosts.length > 0 ? (
                <div className="posts-stack">
                  {filteredPosts.map(post => (
                    <PostCard
                      key={post.post_id}
                      post={post}
                      teacherProfiles={teacherProfiles}
                      onOpenImageLightbox={(photos, idx) => setLightboxData({ images: photos, index: idx })}
                    />
                  ))}
                </div>
              ) : (
                /* 空狀態 */
                <div className="empty-state-card">
                  <div className="empty-state-icon-wrap">
                    <Inbox size={40} className="gold-icon" />
                  </div>
                  <h3 className="empty-state-title">找不到相符貼文</h3>
                  <p className="empty-state-desc">
                    請嘗試調整關鍵字、清除日期篩選，或查看其他教師的貼文。
                  </p>
                  <button
                    type="button"
                    className="clear-all-gold-btn"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedGrade('All');
                      setSelectedTeacher('All');
                      setSelectedDate(null);
                    }}
                  >
                    重設所有篩選
                  </button>
                </div>
              )}
            </section>
          )}

          {/* TAB 2: 時間與篩選 (日曆 + 教師 + 年級) */}
          {activeTab === 'calendar' && (
            <section className="filter-view-tab" aria-label="時間與篩選">
              {/* 日曆卡片 */}
              <div className="filter-card-block">
                <h3 className="section-serif-title">
                  <CalendarIcon size={18} className="gold-icon" />
                  日曆時間檢視
                </h3>
                <Calendar
                  posts={posts}
                  selectedDate={selectedDate}
                  teacherProfiles={teacherProfiles}
                  onSelectDate={(date) => {
                    setSelectedDate(date);
                    // 選擇日期後切換至貼文列表並滾動至頂部
                    handleTabChange('feed');
                  }}
                />
              </div>

              {/* 發文教師篩選卡片 */}
              <div className="filter-card-block">
                <div className="block-title-row">
                  <h3 className="section-serif-title">
                    <Users size={18} className="gold-icon" />
                    發文教師篩選
                  </h3>
                  {availableTeachers.length > 6 && !isTeacherListExpanded && (
                    <button
                      type="button"
                      className="expand-teachers-toggle"
                      onClick={() => setIsTeacherListExpanded(true)}
                    >
                      展開全部 ({availableTeachers.length})
                    </button>
                  )}
                </div>

                {/* 展開後的即時搜尋輸入框 */}
                {isTeacherListExpanded && (
                  <div className="teacher-search-input-wrap">
                    <Search size={14} className="input-search-icon" />
                    <input
                      type="text"
                      placeholder="搜尋教師姓名..."
                      className="teacher-filter-search-field"
                      value={teacherFilterSearch}
                      onChange={(e) => setTeacherFilterSearch(e.target.value)}
                    />
                  </div>
                )}

                <div className="teacher-filter-grid">
                  {displayTeachersList.map(tOpt => {
                    const isSelected = selectedTeacher === tOpt.key;
                    const themeInfo = resolveTeacherTheme(tOpt.key, teacherProfiles);
                    return (
                      <button
                        key={tOpt.key}
                        type="button"
                        onClick={() => {
                          setSelectedTeacher(tOpt.key);
                          handleTabChange('feed');
                        }}
                        className={`teacher-pill-btn ${isSelected ? 'active' : ''}`}
                        style={{
                          '--t-solid': themeInfo.themeTokens.solid,
                          '--t-soft': themeInfo.themeTokens.soft,
                          '--t-ink': themeInfo.themeTokens.ink
                        }}
                      >
                        <div className="teacher-mini-avatar">
                          {themeInfo.initial}
                        </div>
                        <span className="teacher-pill-name">{tOpt.label}</span>
                        <span className="teacher-pill-count">{teacherCounts[tOpt.key] || 0}</span>
                      </button>
                    );
                  })}
                </div>

                {isTeacherListExpanded && (
                  <button
                    type="button"
                    className="collapse-teachers-toggle"
                    onClick={() => {
                      setIsTeacherListExpanded(false);
                      setTeacherFilterSearch('');
                    }}
                  >
                    收合教師清單 ▴
                  </button>
                )}
              </div>

              {/* 年級分類篩選 */}
              <div className="filter-card-block">
                <h3 className="section-serif-title">
                  <Archive size={18} className="gold-icon" />
                  年級分類篩選
                </h3>
                <div className="styled-select-wrap">
                  <select
                    value={selectedGrade}
                    onChange={(e) => {
                      setSelectedGrade(e.target.value);
                      handleTabChange('feed');
                    }}
                    className="brand-select-input"
                    aria-label="年級分類選擇"
                  >
                    {availableGrades.map(gradeOpt => (
                      <option key={gradeOpt.key} value={gradeOpt.key}>
                        {gradeOpt.label} ({gradeCounts[gradeOpt.key] || 0})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 雲端資料庫狀態卡片 (規格書 7.2) */}
              <div className="database-status-card">
                <div className="db-status-header">
                  <span className="db-dot success" />
                  <span className="db-title">雲端資料庫狀態</span>
                </div>
                <p className="db-desc">
                  已直連 Supabase PostgreSQL 資料庫，全量 {posts.length} 筆貼文即時同步檢索。
                </p>
              </div>
            </section>
          )}

          {/* TAB 3: 智慧總結 (Gemini AI + 待辦事項) */}
          {activeTab === 'summary' && (
            <section className="summary-view-tab" aria-label="智慧重要總結">
              <div className="summary-tab-container">
                <SmartSummary
                  filteredPosts={filteredPosts}
                  allPosts={posts}
                  apiKey={geminiApiKey}
                />
              </div>
            </section>
          )}
        </div>
      </main>

      {/* 回到頂部按鈕 */}
      {showBackToTop && (
        <button
          type="button"
          className="back-to-top-fab"
          onClick={scrollToTop}
          aria-label="回到頁面頂部"
          title="回到頂部"
        >
          <ArrowUp size={18} />
        </button>
      )}

      {/* 底部浮動導覽列 (< 768px 啟用，固定於底部 safe-area) */}
      <nav 
        className={`bottom-floating-nav ${isKeyboardOpen ? 'nav-keyboard-hidden' : ''}`}
        aria-label="主要導覽"
      >
        <div className="bottom-nav-grid" role="tablist">
          {/* 1. 時間篩選 */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'calendar'}
            className={`bottom-tab-item ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => handleTabChange('calendar')}
          >
            <CalendarIcon size={22} />
            <span>時間篩選</span>
          </button>

          {/* 2. 貼文 (預設首頁) */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'feed'}
            className={`bottom-tab-item ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => handleTabChange('feed')}
          >
            <div className="tab-icon-relative">
              <Inbox size={22} />
              <span className="tab-pill-badge">{filteredPosts.length}</span>
            </div>
            <span>貼文</span>
          </button>

          {/* 3. 智慧總結 */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'summary'}
            className={`bottom-tab-item ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => handleTabChange('summary')}
          >
            <Sparkles size={22} className="gold-icon" />
            <span>智慧總結</span>
          </button>
        </div>
      </nav>

      {/* 全螢幕搜尋面板 (Search Overlay) */}
      {isSearchOverlayOpen && (
        <div className="fullscreen-search-overlay" role="dialog" aria-modal="true" aria-label="全文搜尋">
          <div className="search-overlay-header">
            <button
              type="button"
              className="search-close-btn"
              onClick={() => setIsSearchOverlayOpen(false)}
              aria-label="關閉搜尋"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="search-overlay-input-wrap">
              <Search size={18} className="search-input-icon" />
              <input
                type="text"
                placeholder="搜尋關鍵字、日期、中英翻譯、功課..."
                className="search-overlay-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="清除關鍵字"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
          <div className="search-overlay-results-bar">
            <span>找到 {filteredPosts.length} 則相符貼文</span>
            <button
              type="button"
              className="view-results-gold-btn"
              onClick={() => {
                setIsSearchOverlayOpen(false);
                handleTabChange('feed');
              }}
            >
              查看結果 →
            </button>
          </div>
        </div>
      )}

      {/* 設定抽屜 (含教師個性化主題維護 7.4) */}
      <div 
        className={`brand-settings-drawer ${isSettingsOpen ? 'open' : ''}`}
        aria-hidden={!isSettingsOpen}
      >
        <div className="drawer-header-bar">
          <div className="drawer-title-group">
            <Settings size={18} className="gold-icon" />
            <h3 className="drawer-heading">工具設定與教師主題</h3>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={() => setIsSettingsOpen(false)}
            aria-label="關閉設定"
          >
            <X size={18} />
          </button>
        </div>

        <div className="drawer-scroll-body">
          {/* 1. Gemini API Key */}
          <div className="settings-card-section">
            <label className="settings-field-label">Gemini API Key</label>
            <input
              type="password"
              className="settings-text-input"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="請輸入 Gemini API Key..."
            />
            <p className="settings-field-desc">
              用於智慧總結與 AI 對話助理。支援從 <code>.env</code> 自動載入。
            </p>
          </div>

          {/* 2. 7.4 教師個性化色彩管理 */}
          <div className="settings-card-section">
            <label className="settings-field-label">
              <span>教師個性化色彩系統</span>
              <span className="settings-badge-sub">免改代碼即時生效</span>
            </label>
            <p className="settings-field-desc">
              為中師、外師設定專屬角色與色票，換導師時直接在此調整即可。
            </p>

            <div className="teachers-profile-manager-list">
              {availableTeachers.filter(t => t.key !== 'All').map(tOpt => {
                const themeInfo = resolveTeacherTheme(tOpt.key, teacherProfiles);
                const currentProfile = teacherProfiles[normalizeName(tOpt.key)] || {};

                return (
                  <div key={tOpt.key} className="teacher-config-row">
                    <div className="teacher-config-left">
                      <div 
                        className="teacher-config-avatar"
                        style={{
                          backgroundColor: themeInfo.themeTokens.soft,
                          borderColor: themeInfo.themeTokens.solid,
                          color: themeInfo.themeTokens.ink
                        }}
                      >
                        {themeInfo.initial}
                      </div>
                      <div className="teacher-config-info">
                        <span className="teacher-config-name">{tOpt.label}</span>
                        <span className="teacher-config-count">{teacherCounts[tOpt.key]} 篇</span>
                      </div>
                    </div>

                    <div className="teacher-config-controls">
                      {/* 角色下拉 (中師 / 外師 / 其他 / 自動) */}
                      <select
                        value={currentProfile.role || ''}
                        onChange={(e) => handleUpdateTeacherProfile(tOpt.key, 'role', e.target.value || null)}
                        className="teacher-role-select"
                        aria-label={`${tOpt.label} 角色設定`}
                      >
                        <option value="">未指定 (自動)</option>
                        <option value="local">中師 (金)</option>
                        <option value="foreign">外師 (藍)</option>
                        <option value="other">專任/其他</option>
                      </select>

                      {/* 顏色選擇下拉 */}
                      <select
                        value={currentProfile.theme || 'auto'}
                        onChange={(e) => handleUpdateTeacherProfile(tOpt.key, 'theme', e.target.value)}
                        className="teacher-theme-select"
                        aria-label={`${tOpt.label} 顏色設定`}
                      >
                        <option value="auto">色彩: 自動雜湊</option>
                        {PALETTE.map(themeKey => (
                          <option key={themeKey} value={themeKey}>
                            {TEACHER_THEMES[themeKey]?.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className="save-settings-gold-btn"
            onClick={handleSaveSettings}
          >
            儲存所有設定
          </button>

          {showSaveSuccess && (
            <div className="save-toast-banner">✓ 設定已儲存成功！</div>
          )}
        </div>
      </div>

      {/* 設定抽屜 Backdrop */}
      {isSettingsOpen && (
        <div 
          className="drawer-dim-backdrop" 
          onClick={() => setIsSettingsOpen(false)}
        />
      )}

      {/* 多圖燈箱 (Lightbox Modal) */}
      {lightboxData && (
        <ImageLightbox
          images={lightboxData.images}
          initialIndex={lightboxData.index}
          onClose={() => setLightboxData(null)}
        />
      )}
    </div>
  );
}
