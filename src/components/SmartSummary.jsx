import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList, CheckSquare, AlertCircle, RefreshCw, Sparkles, BrainCircuit, ArrowLeft } from 'lucide-react';

// 解析聊天訊息中的 Markdown 粗體格式 (**text**)
const renderMessageText = (text) => {
  if (!text) return '';
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

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

  // 自訂 AI 摘要區間狀態 ('filtered' | 'week' | 'month')
  const [aiRange, setAiRange] = useState('filtered');

  // AI 助理對話狀態
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');

  // 複製成功 Toast 狀態
  const [showCopyNoticeToast, setShowCopyNoticeToast] = useState(false);
  const [showCopyTaskToast, setShowCopyTaskToast] = useState(false);
  const [copiedChatIndex, setCopiedChatIndex] = useState(null);

  // 摺疊顯示全部狀態 (規格書 7.3)
  const [showAllNotices, setShowAllNotices] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);

  // 當勾選狀態改變時，寫入 localStorage
  useEffect(() => {
    localStorage.setItem('classdojo_completed_tasks', JSON.stringify(completedTasks));
  }, [completedTasks]);

  // 當篩選條件/貼文列表改變時，重設為本地模式，確保資料即時且避免顯示過期 AI 內容
  useEffect(() => {
    if (aiRange === 'filtered') {
      setSummaryMode('local');
      setAiData(null);
      setAiError('');
    }
  }, [filteredPosts, aiRange]);

  // 切換待辦事項勾選狀態
  const handleToggleTask = (taskText) => {
    setCompletedTasks(prev => ({
      ...prev,
      [taskText]: !prev[taskText]
    }));
  };

  // 獲取最新貼文的日期與月份（用於學期/暑假判斷）
  const latestPostDateInfo = useMemo(() => {
    if (allPosts.length === 0) return { month: 9, baseDate: new Date() };
    const dateStr = allPosts[0].created_at_taiwan ? allPosts[0].created_at_taiwan.split('T')[0] : '';
    if (!dateStr) return { month: 9, baseDate: new Date() };

    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    return {
      month: month,
      baseDate: new Date(year, month - 1, day)
    };
  }, [allPosts]);

  // 計算本週 (7天) 或本月 (30天) 貼文數量
  const counts = useMemo(() => {
    if (allPosts.length === 0) return { week: 0, month: 0 };
    const { baseDate } = latestPostDateInfo;

    let weekCount = 0;
    let monthCount = 0;

    allPosts.forEach(post => {
      if (!post.created_at_taiwan) return;
      const dateStr = post.created_at_taiwan.includes('T')
        ? post.created_at_taiwan.split('T')[0]
        : post.created_at_taiwan.split(' ')[0];
      const parts = dateStr.split('-');
      const postDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

      const diffTime = baseDate.getTime() - postDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (diffDays >= 0) {
        if (diffDays < 7) weekCount++;
        if (diffDays < 30) monthCount++;
      }
    });

    return { week: weekCount, month: monthCount };
  }, [allPosts, latestPostDateInfo]);

  // 根據篩選區間動態計算用於分析的貼文陣列
  const postsForAI = useMemo(() => {
    if (aiRange === 'filtered') {
      return filteredPosts;
    }
    if (allPosts.length === 0) return [];

    const { baseDate } = latestPostDateInfo;
    const daysLimit = aiRange === 'week' ? 7 : 30;

    return allPosts.filter(post => {
      if (!post.created_at_taiwan) return false;
      const dateStr = post.created_at_taiwan.includes('T')
        ? post.created_at_taiwan.split('T')[0]
        : post.created_at_taiwan.split(' ')[0];
      const parts = dateStr.split('-');
      const postDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

      const diffTime = baseDate.getTime() - postDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays < daysLimit;
    });
  }, [aiRange, filteredPosts, allPosts, latestPostDateInfo]);

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
      const postsText = postsForAI.slice(0, 25).map((post, idx) => {
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

  // 呼叫 Gemini API 進行聯絡簿專屬對話
  const handleSendChatMessage = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;
    if (!apiKey) {
      alert('請先點擊右上角齒輪設定，輸入您的 Gemini API Key！');
      return;
    }

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { sender: 'user', text: userMessage }]);
    setIsChatLoading(true);
    setChatError('');

    try {
      // 取得當前摘要選定區間之文章脈絡 (最多 25 筆)
      const contextText = postsForAI.slice(0, 25).map((post, idx) => {
        const dateStr = post.created_at_taiwan || '未知日期';
        const authorStr = post.author || '未知教師';
        const content = post.content_raw || '';
        return `[貼文 #${idx + 1} - 日期: ${dateStr} - 發文教師: ${authorStr}]\n${content}\n---`;
      }).join('\n');

      const systemPrompt = `你是一位親切且專業的班級聯絡簿 AI 秘書。以下是班級聯絡簿的歷史貼文內容：
${contextText}

請根據上述貼文的事實內容，回答家長的問題。請嚴格遵守以下規定：
- 僅根據上述貼文的具體內容進行回答，不要幻想或虛構事實，並且清楚說明是根據哪一天的貼文內容回覆。
- 如果貼文內容中找不到問題的答案，請客氣地告知「抱歉，目前載入的聯絡簿歷史紀錄中沒有提到這項資訊」。
- 回答語氣請親切、口語、有耐心，多使用條列式呈現，方便家長閱讀。`;

      const messages = [
        { role: 'user', parts: [{ text: systemPrompt }] }
      ];

      // 附加最近 6 輪的歷史對話，維持語境連續性
      const recentHistory = chatHistory.slice(-6);
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      });

      // 追加本次使用者的問題
      messages.push({
        role: 'user',
        parts: [{ text: userMessage }]
      });

      const model = 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: messages
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP 錯誤 (${response.status})`);
      }

      const resData = await response.json();
      const aiText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiText) {
        throw new Error('未收到 AI 回傳回應');
      }

      setChatHistory(prev => [...prev, { sender: 'ai', text: aiText }]);
    } catch (err) {
      console.error('Chat API Error:', err);
      setChatError(err.message || '連線失敗');
      setChatHistory(prev => [...prev, { sender: 'ai', text: `❌ 回覆失敗: ${err.message || '請確認 API 金鑰是否正確。'}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // 複製重要公告
  const handleCopyNotices = () => {
    if (currentData.notices.length === 0) return;
    const text = currentData.notices.map(n => `📌 [${n.date}] ${n.text}`).join('\n');
    navigator.clipboard.writeText(text)
      .then(() => {
        setShowCopyNoticeToast(true);
        setTimeout(() => setShowCopyNoticeToast(false), 2000);
      })
      .catch(err => console.error('Failed to copy notices:', err));
  };

  // 複製待辦清單
  const handleCopyTasks = () => {
    if (currentData.tasks.length === 0) return;
    const pending = pendingTasks.map(t => `⬜ [${t.date}] ${t.text}`).join('\n');
    const done = doneTasks.map(t => `✅ [${t.date}] ${t.text}`).join('\n');
    let text = `📝 聯絡簿待辦清單:\n`;
    if (pending) text += `${pending}\n`;
    if (done) {
      text += `\n已完成:\n${done}\n`;
    }
    navigator.clipboard.writeText(text)
      .then(() => {
        setShowCopyTaskToast(true);
        setTimeout(() => setShowCopyTaskToast(false), 2000);
      })
      .catch(err => console.error('Failed to copy tasks:', err));
  };

  // 複製單條對話回答內容
  const handleCopyChatMessage = (text, index) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedChatIndex(index);
        setTimeout(() => setCopiedChatIndex(null), 2000);
      })
      .catch(err => console.error('Failed to copy chat message:', err));
  };

  // 本地引擎分析 (當未啟用 AI 或 AI 載入中時的備用機制，現在也支援 aiRange 的區間)
  const localExtractedData = useMemo(() => {
    const tasks = [];
    const notices = [];
    const seenTasks = new Set();
    const seenNotices = new Set();

    const taskRegex = /^[1-9一二三四五六七八九十]️⃣|^\d+[\.、]|^[a-zA-Z][\.、]|^[（(]\d+[）)]|^[（(][a-zA-Z][）)]/;
    const taskKeywords = ['準備', '準備好', '帶', '帶回', '帶來', '交回', '簽名', '作業', '功課', 'homework', '考', '複習', '整理', '大掃除', '訂正', '寫', '完成'];
    const noticeKeywords = ['腸病毒', '疫情', '停課', '注意', '提醒', '通知', '同樂會', '活動', '營隊', '推薦書單', '公告', '腸病毒個案'];

    const postsToAnalyze = postsForAI.slice(0, 30);

    postsToAnalyze.forEach(post => {
      if (!post.content_raw) return;

      const lines = post.content_raw.split('\n');
      const postDate = post.created_at_taiwan ? (post.created_at_taiwan.includes('T') ? post.created_at_taiwan.split('T')[0] : post.created_at_taiwan.split(' ')[0]) : '未知日期';

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
  }, [postsForAI]);

  // 當前作用的資料來源
  const currentData = useMemo(() => {
    if (summaryMode === 'ai' && aiData) {
      return aiData;
    }
    return localExtractedData;
  }, [summaryMode, aiData, localExtractedData]);

  // 優化項目 B.3: 處理待辦清單的暑假/學期業務邏輯過濾
  const processedTasks = useMemo(() => {
    const rawTasks = currentData.tasks;
    const { month, baseDate } = latestPostDateInfo;
    const isSummerVacation = (month === 7 || month === 8);

    if (isSummerVacation) {
      // 暑假期間：顯示所有待辦事項，並將包含「暑假作業」、「summer homework」、「暑假」的項目置頂
      const vacationTasks = [...rawTasks];
      vacationTasks.sort((a, b) => {
        const isASummer = /暑假作業|summer homework|暑假/i.test(a.text);
        const isBSummer = /暑假作業|summer homework|暑假/i.test(b.text);
        if (isASummer && !isBSummer) return -1;
        if (!isASummer && isBSummer) return 1;
        return 0; // 保持原有順序
      });
      return {
        isSummerVacation: true,
        tasks: vacationTasks
      };
    } else {
      // 學期期間：以最新貼文日期為基準，僅保留最後 7 天內（最後一週）的代辦事項
      const lastWeekTasks = rawTasks.filter(task => {
        if (!task.date) return false;

        let taskDate;
        if (task.date.includes('-')) {
          const parts = task.date.split('-');
          taskDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else if (task.date.includes('/')) {
          const parts = task.date.split('/');
          // 補齊年分 (以最新貼文的年份為基準)
          taskDate = new Date(baseDate.getFullYear(), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
        } else {
          // 如果是其他文字 (如 "公告"、"星期五")，學期期間直接保留，不進行過濾
          return true;
        }

        if (isNaN(taskDate.getTime())) return true; // 解析失敗則保留

        const diffTime = baseDate.getTime() - taskDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        // 保留 7 天內的任務
        return diffDays >= 0 && diffDays < 7;
      });

      return {
        isSummerVacation: false,
        tasks: lastWeekTasks
      };
    }
  }, [currentData.tasks, latestPostDateInfo]);

  // 待辦分流
  const pendingTasks = useMemo(() => {
    return processedTasks.tasks.filter(t => !completedTasks[t.text]);
  }, [processedTasks.tasks, completedTasks]);

  const doneTasks = useMemo(() => {
    if (processedTasks.isSummerVacation) {
      // 暑假期間顯示已完成項目
      return processedTasks.tasks.filter(t => !!completedTasks[t.text]);
    } else {
      // 學期上課期間「僅顯示未完成的功課」，所以已完成回傳空陣列
      return [];
    }
  }, [processedTasks, completedTasks]);

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

      {/* 優化項目 B.2: 摘要範圍切換區 */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', padding: '2px', backgroundColor: '#f1f5f9', borderRadius: '6px' }}>
        {[
          { key: 'filtered', label: '當前篩選' },
          { key: 'week', label: '本週' },
          { key: 'month', label: '近一月' }
        ].map(opt => (
          <button
            key={opt.key}
            onClick={() => setAiRange(opt.key)}
            style={{
              flex: 1,
              border: 'none',
              padding: '6px 4px',
              fontSize: '0.78rem',
              fontWeight: '500',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: aiRange === opt.key ? 'white' : 'transparent',
              color: aiRange === opt.key ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: aiRange === opt.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            {opt.label} ({opt.key === 'filtered' ? filteredPosts.length : opt.key === 'week' ? counts.week : counts.month})
          </button>
        ))}
      </div>

      {/* AI 呼叫控制面板 */}
      <div className="ai-control-panel-v4">
        {apiKey ? (
          <div className="ai-status-row">
            <div className="ai-status-badge">
              <span className="ai-status-dot"></span>
              <span>已連結 Gemini 引擎</span>
            </div>
            <span className="ai-mode-text">
              {summaryMode === 'ai' ? '● AI 總結模式' : '● 本地比對模式'}
            </span>
          </div>
        ) : (
          <div className="ai-disabled-box">
            <span className="ai-disabled-title">⚠️ 未啟用 AI 模式</span>
            <p>請在右上角設定中輸入 Gemini API Key，即可啟用 AI 總結與問答。</p>
          </div>
        )}

        {apiKey && (
          <button
            type="button"
            onClick={handleGenerateAISummary}
            disabled={isLoadingAI}
            className="generate-summary-gold-btn"
          >
            <RefreshCw size={15} className={isLoadingAI ? 'spinner-animate' : ''} />
            <span>{isLoadingAI ? 'Gemini 正在閱讀與分析中...' : `生成 Gemini AI (${aiRange === 'filtered' ? '當前' : aiRange === 'week' ? '本週' : '本月'})總結`}</span>
          </button>
        )}
      </div>

      {/* 詢問 AI 聯絡簿助理 Q&A 對話區塊 */}
      <div className="summary-section-wrap">
        <h4 className="section-serif-title">
          <BrainCircuit size={17} className="gold-icon" />
          詢問 AI 聯絡簿助理
        </h4>

        {/* 對話歷史紀錄 - 氣泡樣式 */}
        <div className="chat-bubble-container">
          {chatHistory.length === 0 ? (
            <div className="chat-empty-state">
              <p className="chat-script-greeting">Hello! 我是聯絡簿 AI 助理</p>
              <p className="chat-empty-hint">您可以點選以下快捷問題，或直接在下方輸入：</p>
              <div className="quick-prompt-chips">
                {[
                  '這週有考試嗎？',
                  '英文老師派了什麼作業？',
                  '明天需要帶什麼文具用品？'
                ].map((prompt, qIdx) => (
                  <button
                    key={qIdx}
                    type="button"
                    className="quick-chip-btn"
                    onClick={() => {
                      setChatInput(prompt);
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chatHistory.map((msg, index) => (
              <div
                key={index}
                className={`chat-bubble-row ${msg.sender === 'user' ? 'user-row' : 'ai-row'}`}
              >
                <div className={`chat-bubble ${msg.sender === 'user' ? 'user-bubble' : 'ai-bubble'}`}>
                  <div className="chat-sender-label">
                    {msg.sender === 'user' ? '您' : 'AI 助理'}
                  </div>
                  <div className="chat-text">
                    {renderMessageText(msg.text)}
                  </div>
                  {msg.sender === 'ai' && (
                    <div className="chat-copy-wrap">
                      <button
                        type="button"
                        onClick={() => handleCopyChatMessage(msg.text, index)}
                        className="copy-bubble-btn"
                        title="複製此回答"
                      >
                        <ClipboardList size={11} />
                        <span>{copiedChatIndex === index ? '已複製！' : '複製回答'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {isChatLoading && (
            <div className="chat-bubble-row ai-row">
              <div className="chat-bubble ai-bubble loading-bubble">
                <RefreshCw size={14} className="spinner-animate" />
                <span>AI 助理正在檢索班級紀錄思考中...</span>
              </div>
            </div>
          )}
          {chatError && (
            <div className="chat-error-row">
              連線錯誤: {chatError}
            </div>
          )}
        </div>

        {/* 輸入與發送 */}
        <form onSubmit={handleSendChatMessage} className="chat-input-form">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="輸入您的問題..."
            disabled={isChatLoading || !apiKey}
            className="chat-input-field"
          />
          <button
            type="submit"
            disabled={isChatLoading || !apiKey || !chatInput.trim()}
            className="chat-send-gold-btn"
          >
            發送
          </button>
        </form>
        {!apiKey && (
          <p className="chat-no-key-hint">
            請在右上角設定設定 Gemini API Key 才能與 AI 對話。
          </p>
        )}
      </div>

      {/* AI 載入中骨架屏 */}
      {isLoadingAI ? (
        <div className="ai-skeleton-loader">
          <div className="skeleton-section">
            <div className="skeleton-bar-title"></div>
            <div className="skeleton-bar-item"></div>
            <div className="skeleton-bar-item"></div>
          </div>
          <div className="skeleton-section">
            <div className="skeleton-bar-title"></div>
            <div className="skeleton-bar-item"></div>
            <div className="skeleton-bar-item"></div>
          </div>
        </div>
      ) : (
        <>
          {/* 注意事項區塊 */}
          <div className="summary-section-wrap" style={{ marginTop: '20px' }}>
            <h4 className="section-serif-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={16} className="gold-icon" />
                重要總結 / 注意事項 ({currentData.notices.length})
              </span>
              {currentData.notices.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyNotices}
                  className="copy-text-btn"
                  title="複製注意事項"
                >
                  <span>{showCopyNoticeToast ? '已複製' : '複製'}</span>
                  <ClipboardList size={13} />
                </button>
              )}
            </h4>
            {currentData.notices.length === 0 ? (
              <div className="summary-empty-text">目前無重要公告提醒</div>
            ) : (
              <div className="notices-flat-list">
                {(showAllNotices ? currentData.notices : currentData.notices.slice(0, 5)).map((notice, index) => (
                  <div key={index} className="notice-card-item">
                    <div className="notice-card-text">{notice.text}</div>
                    <div className="notice-card-date">
                      <span>📅 {notice.date}</span>
                    </div>
                  </div>
                ))}
                {currentData.notices.length > 5 && (
                  <button
                    type="button"
                    className="show-more-toggle-btn"
                    onClick={() => setShowAllNotices(!showAllNotices)}
                  >
                    {showAllNotices ? '收合部分注意事項 ▴' : `顯示全部注意事項 (${currentData.notices.length}) ▾`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 聯絡簿待辦清單區塊 (依日期分組顯示) */}
          <div className="summary-section-wrap" style={{ marginTop: '24px' }}>
            <h4 className="section-serif-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckSquare size={16} className="gold-icon" />
                聯絡簿待辦清單 ({pendingTasks.length})
              </span>
              {pendingTasks.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyTasks}
                  className="copy-text-btn"
                  title="複製待辦項目"
                >
                  <span>{showCopyTaskToast ? '已複製' : '複製'}</span>
                  <ClipboardList size={13} />
                </button>
              )}
            </h4>

            {pendingTasks.length === 0 && doneTasks.length === 0 ? (
              <div className="summary-empty-text">目前無待辦功課項目</div>
            ) : (
              <div className="todos-flat-list">
                {/* 待處理項目 (按日期群組展示) */}
                {pendingTasks.length > 0 && (
                  <>
                    <div className="todo-group-header-label">
                      <span>📝 待處理項目 ({pendingTasks.length})</span>
                    </div>
                    {/* 分組卡片 */}
                    {Object.entries(
                      (showAllTasks ? pendingTasks : pendingTasks.slice(0, 8)).reduce((acc, task) => {
                        const d = task.date || '重要待辦';
                        if (!acc[d]) acc[d] = [];
                        acc[d].push(task);
                        return acc;
                      }, {})
                    ).map(([dateGroup, tasksInDate], gIdx) => (
                      <div key={gIdx} className="todo-date-group-card">
                        <div className="todo-date-group-title">
                          <span>📅 {dateGroup}</span>
                          <span className="todo-date-count">{tasksInDate.length} 項</span>
                        </div>
                        <div className="todo-date-items">
                          {tasksInDate.map((task, tIdx) => (
                            <div
                              key={tIdx}
                              className="todo-single-row"
                              onClick={() => handleToggleTask(task.text)}
                            >
                              <div className="custom-gold-checkbox" aria-hidden="true" />
                              <div className="todo-row-content">
                                <span className="todo-row-text">{task.text}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {pendingTasks.length > 8 && (
                      <button
                        type="button"
                        className="show-more-toggle-btn"
                        onClick={() => setShowAllTasks(!showAllTasks)}
                      >
                        {showAllTasks ? '收合部分待辦 ▴' : `顯示全部待辦清單 (${pendingTasks.length}) ▾`}
                      </button>
                    )}
                  </>
                )}

                {/* 已完成項目 */}
                {doneTasks.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div className="todo-group-header-label done-label">
                      <span>✅ 已完成項目 ({doneTasks.length})</span>
                    </div>
                    <div className="todo-date-group-card completed-group">
                      <div className="todo-date-items">
                        {doneTasks.map((task, dIdx) => (
                          <div
                            key={dIdx}
                            className="todo-single-row completed"
                            onClick={() => handleToggleTask(task.text)}
                          >
                            <div className="custom-gold-checkbox checked" aria-hidden="true" />
                            <div className="todo-row-content">
                              <span className="todo-row-text">{task.text}</span>
                              <span className="todo-done-date">{task.date}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
