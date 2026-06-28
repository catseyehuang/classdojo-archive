import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList, CheckSquare, AlertCircle, RefreshCw, Sparkles, BrainCircuit, ArrowLeft } from 'lucide-react';

export default function SmartSummary({ filteredPosts, allPosts, apiKey }) {
  // 記錄使用者勾選已完成的待辦事項
  const [completedTasks, setCompletedTasks] = useState(() => {
    try {
      const saved = localStorage.getItem('classdojo_completed_tasks');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // 模式切換：'local' (本地關鍵字比對) | 'ai' (Gemini AI 總結)
  const [summaryMode, setSummaryMode] = useState('local');
  const [aiData, setAiData] = useState(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState('');

  // 當勾選狀態改變時，寫入 localStorage
  useEffect(() => {
    localStorage.setItem('classdojo_completed_tasks', JSON.stringify(completedTasks));
  }, [completedTasks]);

  // 當篩選條件/貼文列表改變時，重設為本地模式，確保資料即時且避免顯示過期 AI 內容
  useEffect(() => {
    setSummaryMode('local');
    setAiData(null);
    setAiError('');
  }, [filteredPosts]);

  // 切換待辦事項勾選狀態
  const handleToggleTask = (taskText) => {
    setCompletedTasks(prev => ({
      ...prev,
      [taskText]: !prev[taskText]
    }));
  };

  // 呼叫 Gemini API 進行智慧摘要與分類
  const handleGenerateAISummary = async () => {
    if (!apiKey) {
      alert('請先點擊右上角齒輪設定，輸入您的 Gemini API Key！');
      return;
    }

    setIsLoadingAI(true);
    setAiError('');
    
    try {
      // 取得前 25 筆貼文內容，避免超出 context limit 且加快生成速度
      const postsText = filteredPosts.slice(0, 25).map((post, idx) => {
        const dateStr = post.created_at_taiwan || '未知日期';
        const authorStr = post.author || '未知教師';
        const content = post.content_raw || '';
        return `[貼文 #${idx + 1} - 日期: ${dateStr} - 發文教師: ${authorStr}]\n${content}\n---`;
      }).join('\n');

      const promptText = `你是一位專業且細心的班級聯絡簿秘書。請詳細閱讀並分析以下班級聯絡簿貼文，並整理出兩類重點資訊：
1. 「重要事項與公告提醒」（例如：學校重要活動、停課/停餐通知、健康宣導、同樂會、繳費通知等，請排除日常作業功課）
2. 「聯絡簿待辦清單」（例如：各科作業功課、明天需帶的文具、需要家長配合簽名的項目、考試複習項目等）

請嚴格遵守以下規定：
- 僅提取以下貼文中確切提到的事實與待辦，絕不可無中生有。
- 若貼文中有提到具體日期或星期，請將其填寫在 "date" 欄位中（例如 "6/28" 或 "星期五"）。如果沒有提到日期，請使用 "date": "公告"。
- 每一項整理出來的內容請保持精簡、字數不宜過長，格式要好讀。
- 必須以合法的 JSON 格式輸出，不要包含任何 markdown 標籤（例如 \`\`\`json 等）或多餘字元。

JSON 格式規範如下：
{
  "notices": [
    { "text": "事項內容一", "date": "日期" }
  ],
  "tasks": [
    { "text": "待辦功課/項目一", "date": "日期" }
  ]
}

以下為待分析的聯絡簿貼文：
${postsText}`;

      const model = 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: promptText }]
          }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP API error (${response.status})`);
      }

      const resData = await response.json();
      const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini API 未回傳內容');
      }

      // 清除可能含有的 markdown backticks 符號
      let cleanedText = text.trim();
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(cleanedText);
      if (!parsed.notices || !parsed.tasks) {
        throw new Error('回傳 JSON 欄位不完整');
      }

      setAiData(parsed);
      setSummaryMode('ai');
    } catch (err) {
      console.error('Gemini API Error:', err);
      setAiError(err.message || 'AI 連線或解析失敗');
      alert(`AI 總結失敗: ${err.message || '請確認 API 金鑰有效並啟用了 Gemini/Generative Language API 權限'}`);
    } finally {
      setIsLoadingAI(false);
    }
  };

  // 本地引擎分析 (當未啟用 AI 或 AI 載入中時的備用機制)
  const localExtractedData = useMemo(() => {
    const tasks = [];
    const notices = [];
    const seenTasks = new Set();
    const seenNotices = new Set();

    const taskRegex = /^[1-9一二三四五六七八九十]️⃣|^\d+[\.、]|^[a-zA-Z][\.、]|^[（(]\d+[）)]|^[（(][a-zA-Z][）)]/;
    const taskKeywords = ['準備', '準備好', '帶', '帶回', '帶來', '交回', '簽名', '作業', '功課', 'homework', '考', '複習', '整理', '大掃除', '訂正', '寫', '完成'];
    const noticeKeywords = ['腸病毒', '疫情', '停課', '注意', '提醒', '通知', '同樂會', '活動', '營隊', '推薦書單', '公告', '腸病毒個案'];

    const postsToAnalyze = filteredPosts.slice(0, 30);

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

  // 當前作用的資料來源
  const currentData = useMemo(() => {
    if (summaryMode === 'ai' && aiData) {
      return aiData;
    }
    return localExtractedData;
  }, [summaryMode, aiData, localExtractedData]);

  // 待辦清單分流
  const pendingTasks = useMemo(() => {
    return currentData.tasks.filter(t => !completedTasks[t.text]);
  }, [currentData.tasks, completedTasks]);

  const doneTasks = useMemo(() => {
    return currentData.tasks.filter(t => !!completedTasks[t.text]);
  }, [currentData.tasks, completedTasks]);

  return (
    <div className="todo-container">
      {/* 智慧總結標題 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '14px' }}>
        <h3 className="panel-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BrainCircuit size={18} style={{ color: 'var(--primary)' }} />
          Gemini 智慧洞察
        </h3>
        
        {summaryMode === 'ai' && (
          <button 
            onClick={() => setSummaryMode('local')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9' }}
            title="返回本地引擎"
          >
            <ArrowLeft size={13} />
            本地模式
          </button>
        )}
      </div>

      {/* AI 呼叫控制面板 */}
      <div className="ai-control-panel" style={{ padding: '12px', borderRadius: '8px', background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', border: '1px solid #d1fae5', marginBottom: '16px' }}>
        {apiKey ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={14} style={{ color: '#10b981' }} />
                已連結 Gemini 引擎
              </span>
              <span style={{ fontSize: '0.72rem', color: summaryMode === 'ai' ? '#047857' : '#9b9b9b' }}>
                {summaryMode === 'ai' ? '● AI 總結模式' : '● 本地比對模式'}
              </span>
            </div>
            
            <button
              onClick={handleGenerateAISummary}
              disabled={isLoadingAI}
              className="filter-btn active"
              style={{
                width: '100%',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                padding: '8px',
                fontSize: '0.82rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: isLoadingAI ? 'not-allowed' : 'pointer',
                borderRadius: '6px',
                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.15)'
              }}
            >
              <RefreshCw size={14} className={isLoadingAI ? 'spinner-animate' : ''} style={{ animation: isLoadingAI ? 'spin 1s linear infinite' : 'none' }} />
              {isLoadingAI ? 'Gemini 正在閱讀與分析中...' : '生成 Gemini AI 智慧總結'}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ⚠️ 未啟用 AI 模式
            </span>
            請在右上角齒輪設定中輸入您的 Gemini API Key，即可啟用強大的 AI 智慧總結與分類功能。目前使用預設本地過濾。
          </div>
        )}
      </div>

      {/* AI 載入中骨架屏 */}
      {isLoadingAI ? (
        <div className="ai-skeleton-loader" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="skeleton-section" style={{ animation: 'pulse 1.5s infinite ease-in-out' }}>
            <div style={{ height: '16px', background: '#e2e8f0', borderRadius: '4px', width: '50%', marginBottom: '8px' }}></div>
            <div style={{ height: '35px', background: '#f1f5f9', borderRadius: '6px', width: '100%', marginBottom: '6px' }}></div>
            <div style={{ height: '35px', background: '#f1f5f9', borderRadius: '6px', width: '100%' }}></div>
          </div>
          <div className="skeleton-section" style={{ animation: 'pulse 1.5s infinite ease-in-out', animationDelay: '0.2s' }}>
            <div style={{ height: '16px', background: '#e2e8f0', borderRadius: '4px', width: '40%', marginBottom: '8px' }}></div>
            <div style={{ height: '35px', background: '#f1f5f9', borderRadius: '6px', width: '100%', marginBottom: '6px' }}></div>
            <div style={{ height: '35px', background: '#f1f5f9', borderRadius: '6px', width: '100%' }}></div>
          </div>
        </div>
      ) : (
        <>
          {/* 注意事項區塊 */}
          <div className="sidebar-section">
            <h4 className="panel-title" style={{ fontSize: '0.88rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
              <AlertCircle size={15} style={{ color: 'var(--accent)' }} />
              智慧重要總結 / 注意事項 ({currentData.notices.length})
            </h4>
            {currentData.notices.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '16px 0' }}>
                目前無重要公告提醒
              </div>
            ) : (
              <div className="todo-list" style={{ maxHeight: '260px' }}>
                {currentData.notices.map((notice, index) => (
                  <div 
                    key={index} 
                    className="todo-item"
                    style={{ cursor: 'default', borderLeft: '3.5px solid var(--accent)', padding: '8px 10px', background: '#f8fafc', marginBottom: '6px' }}
                  >
                    <div style={{ flexGrow: 1 }}>
                      <div className="todo-text" style={{ fontWeight: '500', fontSize: '0.8rem', color: '#1e293b', lineHeight: '1.4' }}>{notice.text}</div>
                      <div className="todo-meta">
                        <span>📅 {notice.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 待辦事項區塊 */}
          <div className="sidebar-section" style={{ marginTop: '16px' }}>
            <h4 className="panel-title" style={{ fontSize: '0.88rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
              <CheckSquare size={15} style={{ color: 'var(--primary)' }} />
              聯絡簿待辦清單 ({currentData.tasks.length})
            </h4>
            {currentData.tasks.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '16px 0' }}>
                目前無待辦功課項目
              </div>
            ) : (
              <div className="todo-list">
                {/* 待處理項目 */}
                {pendingTasks.length > 0 && (
                  <>
                    <div className="todo-subheading" style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: '600', margin: '8px 0 4px' }}>📝 待處理 ({pendingTasks.length})</div>
                    {pendingTasks.map((task, index) => (
                      <div 
                        key={`pending-${index}`} 
                        className="todo-item"
                        style={{ padding: '8px 10px', display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: 'pointer', marginBottom: '4px' }}
                        onClick={() => handleToggleTask(task.text)}
                      >
                        <input 
                          type="checkbox" 
                          checked={false}
                          onChange={() => {}}
                          className="todo-checkbox"
                          style={{ marginTop: '2px' }}
                          onClick={(e) => e.stopPropagation()} 
                        />
                        <div style={{ flexGrow: 1 }}>
                          <div className="todo-text" style={{ fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>{task.text}</div>
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
                    <div className="todo-subheading done" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: '600', margin: '12px 0 4px' }}>✅ 已完成 ({doneTasks.length})</div>
                    {doneTasks.map((task, index) => (
                      <div 
                        key={`done-${index}`} 
                        className="todo-item completed"
                        style={{ padding: '8px 10px', display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: 'pointer', marginBottom: '4px' }}
                        onClick={() => handleToggleTask(task.text)}
                      >
                        <input 
                          type="checkbox" 
                          checked={true}
                          onChange={() => {}}
                          className="todo-checkbox"
                          style={{ marginTop: '2px' }}
                          onClick={(e) => e.stopPropagation()} 
                        />
                        <div style={{ flexGrow: 1 }}>
                          <div className="todo-text" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{task.text}</div>
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
        </>
      )}
    </div>
  );
}
