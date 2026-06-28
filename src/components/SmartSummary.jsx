import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList, CheckSquare, AlertCircle, RefreshCw } from 'lucide-react';

export default function SmartSummary({ filteredPosts, allPosts }) {
  // 記錄使用者勾選已完成的待辦事項 ID (使用 localStorage 持久化)
  const [completedTasks, setCompletedTasks] = useState(() => {
    try {
      const saved = localStorage.getItem('classdojo_completed_tasks');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // 模擬智慧總結重新整理
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  // 當勾選狀態改變時，寫入 localStorage
  useEffect(() => {
    localStorage.setItem('classdojo_completed_tasks', JSON.stringify(completedTasks));
  }, [completedTasks]);

  // 切換待辦事項勾選狀態
  const handleToggleTask = (taskText) => {
    setCompletedTasks(prev => ({
      ...prev,
      [taskText]: !prev[taskText]
    }));
  };

  // 智慧解析貼文內容，提取待辦與注意事項
  const extractedData = useMemo(() => {
    const tasks = [];
    const notices = [];
    const seenTasks = new Set();
    const seenNotices = new Set();

    // 關鍵字與正則表達式
    const taskRegex = /^[1-9一二三四五六七八九十]️⃣|^\d+[\.、]|^[a-zA-Z][\.、]|^[（(]\d+[）)]|^[（(][a-zA-Z][）)]/;
    
    // 用於任務判定的關鍵字
    const taskKeywords = ['準備', '準備好', '帶', '帶回', '帶來', '交回', '簽名', '作業', '功課', 'homework', '考', '複習', '整理', '大掃除', '訂正', '寫', '完成'];
    // 用於重要通知判定的關鍵字
    const noticeKeywords = ['腸病毒', '疫情', '停課', '注意', '提醒', '通知', '同樂會', '活動', '營隊', '推薦書單', '公告', '腸病毒個案'];

    const postsToAnalyze = filteredPosts.slice(0, 50);

    postsToAnalyze.forEach(post => {
      if (!post.content_raw) return;

      const lines = post.content_raw.split('\n');
      const postDate = post.created_at_taiwan ? post.created_at_taiwan.split(' ')[0] : '未知日期';

      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.length < 4) return;
        if (trimmed.startsWith('http') || trimmed.startsWith('https')) return;

        const hasTaskPrefix = taskRegex.test(trimmed);
        const hasTaskKeyword = taskKeywords.some(keyword => trimmed.includes(keyword));
        const hasNoticeKeyword = noticeKeywords.some(keyword => trimmed.includes(keyword));

        // 待辦事項
        if ((hasTaskPrefix || hasTaskKeyword) && !trimmed.includes('相簿') && !trimmed.includes('連結') && !trimmed.includes('下載')) {
          let cleanText = trimmed;
          if (cleanText.length > 80) {
            cleanText = cleanText.substring(0, 80) + '...';
          }
          
          if (!seenTasks.has(cleanText)) {
            seenTasks.add(cleanText);
            tasks.push({
              text: cleanText,
              date: postDate,
              postId: post.post_id
            });
          }
        } 
        // 注意事項
        else if (hasNoticeKeyword && !hasTaskKeyword) {
          let cleanText = trimmed;
          if (cleanText.length > 90) {
            cleanText = cleanText.substring(0, 90) + '...';
          }
          
          if (!seenNotices.has(cleanText) && cleanText.length > 5) {
            seenNotices.add(cleanText);
            notices.push({
              text: cleanText,
              date: postDate,
              postId: post.post_id
            });
          }
        }
      });
    });

    return { tasks, notices };
  }, [filteredPosts]);

  // 待辦事項分流
  const pendingTasks = useMemo(() => {
    return extractedData.tasks.filter(t => !completedTasks[t.text]);
  }, [extractedData.tasks, completedTasks]);

  const doneTasks = useMemo(() => {
    return extractedData.tasks.filter(t => !!completedTasks[t.text]);
  }, [extractedData.tasks, completedTasks]);

  return (
    <div className="todo-container">
      {/* 智慧總結標題 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '8px' }}>
        <h3 className="panel-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardList size={18} style={{ color: 'var(--accent)' }} />
          Gemini 智慧洞察
        </h3>
        <button 
          onClick={handleRefresh}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px' }}
          className={isRefreshing ? 'spinner-animate' : ''}
          title="重新整理智慧洞察"
        >
          <RefreshCw size={15} style={{ animation: isRefreshing ? 'spin 0.6s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* 注意事項區塊 (Flat Sidebar Section) */}
      <div className="sidebar-section">
        <h4 className="panel-title" style={{ fontSize: '0.88rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
          <AlertCircle size={15} style={{ color: 'var(--accent)' }} />
          智慧重要總結 / 注意事項 ({extractedData.notices.length})
        </h4>
        {extractedData.notices.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '16px 0' }}>
            目前無重要公告提醒
          </div>
        ) : (
          <div className="todo-list" style={{ maxHeight: '240px' }}>
            {extractedData.notices.map((notice, index) => (
              <div 
                key={index} 
                className="todo-item"
                style={{ cursor: 'default', borderLeft: '3.5px solid var(--accent)', padding: '6px 10px', background: '#f8fafc' }}
              >
                <div style={{ flexGrow: 1 }}>
                  <div className="todo-text" style={{ fontWeight: '500', fontSize: '0.8rem' }}>{notice.text}</div>
                  <div className="todo-meta">
                    <span>📅 {notice.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 待辦事項區塊 (Flat Sidebar Section) */}
      <div className="sidebar-section">
        <h4 className="panel-title" style={{ fontSize: '0.88rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
          <CheckSquare size={15} style={{ color: 'var(--primary)' }} />
          聯絡簿待辦清單 ({extractedData.tasks.length})
        </h4>
        {extractedData.tasks.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '16px 0' }}>
            目前無待辦功課項目
          </div>
        ) : (
          <div className="todo-list">
            {/* 待處理項目 */}
            {pendingTasks.length > 0 && (
              <>
                <div className="todo-subheading" style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>📝 待處理 ({pendingTasks.length})</div>
                {pendingTasks.map((task, index) => (
                  <div 
                    key={`pending-${index}`} 
                    className="todo-item"
                    style={{ padding: '6px 8px' }}
                    onClick={() => handleToggleTask(task.text)}
                  >
                    <input 
                      type="checkbox" 
                      checked={false}
                      onChange={() => {}}
                      className="todo-checkbox"
                      onClick={(e) => e.stopPropagation()} 
                    />
                    <div style={{ flexGrow: 1 }}>
                      <div className="todo-text" style={{ fontSize: '0.78rem' }}>{task.text}</div>
                      <div className="todo-meta">
                        <span>📅 {task.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* 已完成項目 */}
            {doneTasks.length > 0 && (
              <>
                <div className="todo-subheading done" style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>✅ 已完成 ({doneTasks.length})</div>
                {doneTasks.map((task, index) => (
                  <div 
                    key={`done-${index}`} 
                    className="todo-item completed"
                    style={{ padding: '6px 8px' }}
                    onClick={() => handleToggleTask(task.text)}
                  >
                    <input 
                      type="checkbox" 
                      checked={true}
                      onChange={() => {}}
                      className="todo-checkbox"
                      onClick={(e) => e.stopPropagation()} 
                    />
                    <div style={{ flexGrow: 1 }}>
                      <div className="todo-text" style={{ fontSize: '0.78rem' }}>{task.text}</div>
                      <div className="todo-meta">
                        <span>📅 {task.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
