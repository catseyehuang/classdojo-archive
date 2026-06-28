import React, { useState, useEffect, useMemo } from 'react';
import { Search, Inbox, Archive, Calendar as CalendarIcon, ClipboardList, Users } from 'lucide-react';
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
        <div className="header-left">
          <div className="header-logo-icon">D</div>
          <div className="header-title-group">
            <h1 className="header-title">Dojo Archive</h1>
            <div className="header-subtitle">未命名學生 • 未設定班級</div>
          </div>
        </div>
        
        {/* 全文檢索搜尋框居中 */}
        <div className="header-center">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="全文檢索 ClassDojo 歷史紀錄..."
              className="search-input"
              aria-label="搜尋貼文"
            />
          </div>
        </div>

        {/* 雲端同步狀態在右側 */}
        <div className="header-right">
          <span className="sync-dot"></span>
          <span>雲端同步中</span>
        </div>
      </header>

      {/* 主要三欄版面 - 左右整條側塊無氣泡框 */}
      <main className="app-dashboard">
        
        {/* 左側欄 (22% 寬)：日曆與篩選 */}
        <section className="sidebar-panel sidebar-left">
          
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

          {/* 年級篩選器 */}
          <div className="sidebar-section">
            <h3 className="panel-title">
              <Archive size={16} style={{ color: 'var(--primary)' }} />
              年級分類篩選
            </h3>
            <div className="grade-filter-list">
              {[
                { key: 'All', label: '所有年級' },
                { key: '114年下學期(二下)', label: '114年下學期(二下)' },
                { key: '114年上學期(二上)', label: '114年上學期(二上)' },
                { key: '113年下學期(一下)', label: '113年下學期(一下)' },
                { key: '113年上學期(一上)', label: '113年上學期(一上)' }
              ].map(gradeOpt => (
                <button
                  key={gradeOpt.key}
                  onClick={() => setSelectedGrade(gradeOpt.key)}
                  className={`filter-btn ${selectedGrade === gradeOpt.key ? 'active' : ''}`}
                >
                  <span>{gradeOpt.label}</span>
                  <span className="filter-count">{gradeCounts[gradeOpt.key] || 0}</span>
                </button>
              ))}
            </div>
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
                { key: 'Teacher Adam', label: 'Adam 老師' },
                { key: 'Teacher Patty', label: 'Patty 老師' }
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

          {/* 雲端同步說明區塊 (貼底放置) */}
          <div className="sync-info-box">
            <div className="sync-info-title">
              <span>ℹ️ 關於 Google Drive 同步：</span>
            </div>
            請在您的 Google 雲端硬碟根目錄設置名為 <code style={{ color: 'var(--accent)', fontWeight: '600' }}>dojo_data.json</code> 的檔案。本系統會自動連結進行全文分析。
          </div>
        </section>

        {/* 中側欄：滾動 Feed 區塊 */}
        <section className="feed-column">
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
        <section className="sidebar-panel sidebar-right">
          <SmartSummary 
            filteredPosts={filteredPosts} 
            allPosts={posts} 
          />
        </section>

      </main>
    </div>
  );
}
