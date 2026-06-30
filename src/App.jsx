import React, { useState, useEffect, useMemo } from 'react';
import { Search, Inbox, Archive, Calendar as CalendarIcon, ClipboardList, Users, Cloud, Settings, X, Loader2, RefreshCw, BrainCircuit, ArrowLeft } from 'lucide-react';
import Calendar from './components/Calendar';
import PostCard from './components/PostCard';
import SmartSummary from './components/SmartSummary';
import './index.css';

export default function App() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('All');
  const [selectedTeacher, setSelectedTeacher] = useState('All');
  const [selectedDate, setSelectedDate] = useState(null); // YYYY-MM-DD

  // Google Drive & Settings states
  const [driveApiKey, setDriveApiKey] = useState(() => localStorage.getItem('dojo_google_drive_api_key') || '');
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('dojo_gemini_api_key') || '');
  const [folderId, setFolderId] = useState(() => localStorage.getItem('dojo_folder_id') || '');
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [syncError, setSyncError] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState('feed'); // 'filter' | 'feed' | 'summary'
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const handleSaveSettings = () => {
    localStorage.setItem('dojo_google_drive_api_key', driveApiKey);
    localStorage.setItem('dojo_gemini_api_key', geminiApiKey);
    localStorage.setItem('dojo_folder_id', folderId);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 2000);
  };

  // 動態自本地/雲端同步的 json 檔案載入資料
  useEffect(() => {
    setLoading(true);
    fetch('./dojo_data.json')
      .then(res => {
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        return res.json();
      })
      .then(data => {
        setPosts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading dojo_data.json dynamically:", err);
        setLoading(false);
      });
  }, []);

  // 連結到 Google Drive 讀取 dojo_data.json
  const handleConnectGDrive = async () => {
    const finalApiKey = driveApiKey.trim();
    if (!finalApiKey) {
      alert('請先在設定中輸入 Google Drive API Key！');
      setIsSettingsOpen(true);
      return;
    }

    const finalFolderId = folderId.trim() || '1FdOzexsdBaIGcUXnKIoS0S-dyB_m-FMr';
    setSyncStatus('loading');
    setSyncError('');
    setLoading(true);

    try {
      // 步驟 1: 在指定資料夾中搜尋檔案並加上 Shared Drive 支援參數
      const q = encodeURIComponent(`'${finalFolderId}' in parents and trashed = false`);
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&key=${finalApiKey}&supportsAllDrives=true&includeItemsFromAllDrives=true`;

      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) {
        const errorData = await searchRes.json().catch(() => ({}));
        const msg = errorData.error?.message || '讀取資料夾失敗';
        throw new Error(msg);
      }

      const searchData = await searchRes.json();
      if (!searchData.files || searchData.files.length === 0) {
        throw new Error('在該雲端資料夾中找不到任何檔案，請確認資料夾權限已開放為「知道連結的任何人皆可檢視」');
      }

      // 在 JavaScript 中不分大小寫比對檔名，避免 query 語法限制
      const matchedFile = searchData.files.find(f => f.name.trim().toLowerCase() === 'dojo_data.json');
      if (!matchedFile) {
        throw new Error('在資料夾中找不到名稱為 dojo_data.json 的檔案（請確認檔名大小寫與拼字是否完全一致）');
      }

      const fileId = matchedFile.id;

      // 步驟 2: 藉由 fileId 下載檔案內容
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${finalApiKey}&supportsAllDrives=true`;
      const downloadRes = await fetch(downloadUrl);
      if (!downloadRes.ok) {
        const errorData = await downloadRes.json().catch(() => ({}));
        const msg = errorData.error?.message || '下載檔案失敗';
        throw new Error(msg);
      }

      const data = await downloadRes.json();
      if (Array.isArray(data)) {
        setPosts(data);
        setSyncStatus('success');
      } else {
        throw new Error('下載的 JSON 格式不符合預期的貼文陣列');
      }
    } catch (err) {
      console.error('Google Drive Sync Error:', err);
      setSyncStatus('error');
      setSyncError(err.message || '連線發生錯誤');
      alert(`連結 Google Drive 失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
    }
  };

  // 計算每個年級的原始總文章數
  const gradeCounts = useMemo(() => {
    const counts = {
      'All': posts.length,
      '114年下學期(二下)': 0,
      '114年上學期(二上)': 0,
      '113年下學期(一下)': 0,
      '113年上學期(一上)': 0
    };

    posts.forEach(post => {
      if (post.grade && post.grade in counts) {
        counts[post.grade]++;
      }
    });

    return counts;
  }, [posts]);

  // 計算每個老師的原始文章數
  const teacherCounts = useMemo(() => {
    const counts = {
      'All': posts.length,
      'Teacher Adam': 0,
      'Teacher Patty': 0
    };

    posts.forEach(post => {
      if (post.author && post.author in counts) {
        counts[post.author]++;
      }
    });

    return counts;
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
                    <span className={`sync-dot ${syncStatus === 'idle' ? 'local' : syncStatus}`} style={{ width: '6px', height: '6px', boxShadow: 'none' }}></span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {syncStatus === 'success' ? '雲端' : syncStatus === 'loading' ? '同步' : '本地'}
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
                {syncStatus === 'idle' && <span className="sync-dot local"></span>}
                <span className={`sync-status-text ${syncStatus}`}>
                  {syncStatus === 'loading' && '同步中...'}
                  {syncStatus === 'success' && '雲端同步中'}
                  {syncStatus === 'error' && '同步失敗'}
                  {syncStatus === 'idle' && '本地資料'}
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

              {syncStatus === 'success' ? (
                <button
                  className="gdrive-refresh-btn"
                  onClick={handleConnectGDrive}
                  title="重新更新雲端資料"
                  aria-label="重新更新雲端資料"
                >
                  <RefreshCw size={16} className={syncStatus === 'loading' ? "spinner-animate" : ""} style={{ animation: syncStatus === 'loading' ? 'spin 1s linear infinite' : 'none' }} />
                </button>
              ) : (
                <button className="gdrive-btn" onClick={handleConnectGDrive} disabled={syncStatus === 'loading'}>
                  <Cloud size={16} className="gdrive-icon" />
                  <span className="desktop-btn-text">連結 Google Drive</span>
                </button>
              )}

              <button className="settings-btn" onClick={() => setIsSettingsOpen(true)} title="開啟設定">
                <Settings size={18} />
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
              {[
                { key: 'All', label: '所有教師' },
                { key: 'Teacher Adam', label: 'Tr. Adam' },
                { key: 'Teacher Patty', label: 'Tr. Patty' }
              ].map(tOpt => (
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
                {[
                  { key: 'All', label: '所有年級' },
                  { key: '114年下學期(二下)', label: '114年下學期(二下)' },
                  { key: '114年上學期(二上)', label: '114年上學期(二上)' },
                  { key: '113年下學期(一下)', label: '113年下學期(一下)' },
                  { key: '113年上學期(一上)', label: '113年上學期(一上)' }
                ].map(gradeOpt => (
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
              <span>ℹ️ 關於 Google Drive 同步：</span>
            </div>
            請在您的 Google 雲端硬碟根目錄設置名為 <code style={{ color: 'var(--accent)', fontWeight: '600' }}>dojo_data.json</code> 的檔案。本系統會自動連結進行全文分析。
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
              <span>正在從雲端 Drive 載入數據...</span>
            </div>
          ) : filteredPosts.length > 0 ? (
            filteredPosts.map(post => (
              <PostCard key={post.post_id} post={post} />
            ))
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
            <label className="settings-label">Google Drive API Key</label>
            <input
              type="password"
              className="settings-input"
              value={driveApiKey}
              onChange={(e) => setDriveApiKey(e.target.value)}
              placeholder="請輸入 Google Drive API Key..."
            />
            <p className="settings-desc">
              用於連線 Google Drive API 搜尋與下載 dojo_data.json。
            </p>
          </div>
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
              用於右側智慧總結，透過 Gemini API 自動歸納功課與注意事項。
            </p>
          </div>
          <div className="settings-field">
            <label className="settings-label">Google Drive Folder ID</label>
            <input
              type="text"
              className="settings-input"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              placeholder="請輸入雲端資料夾 ID"
            />
            <p className="settings-desc">
              請輸入包含 dojo_data.json 的雲端資料夾 ID。
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
