import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, Camera, Edit3, Image as ImageIcon, Sparkles, Loader2, Plus, 
  Trash2, X, AlertTriangle, CheckSquare, Upload, Calendar 
} from 'lucide-react';
import { 
  getActiveHomeworkDate, getSavedHomeworkState, saveHomeworkState, 
  DEFAULT_DEMO_HOMEWORK 
} from '../utils/homeworkEngine';

export default function DailyContactHub({ 
  posts = [], 
  apiKey = '', 
  onOpenLightbox,
  onExamsExtracted 
}) {
  const activeDateInfo = getActiveHomeworkDate();
  const [homeworkData, setHomeworkData] = useState(() => 
    getSavedHomeworkState(activeDateInfo.activeDate)
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [photoPreview, setPhotoPreview] = useState(homeworkData.photoUrl || '/thumbnail-contact.jpg');

  const fileInputRef = useRef(null);

  // 當日期或任務變動時儲存
  useEffect(() => {
    saveHomeworkState(homeworkData);
  }, [homeworkData]);

  // 切換單一作業打勾狀態
  const handleToggleTask = (column, taskId) => {
    setHomeworkData(prev => {
      const targetList = column === 'chinese' ? prev.chineseTasks : prev.englishTasks;
      const updatedList = targetList.map(item => {
        if (item.id === taskId) {
          return { ...item, completed: !item.completed };
        }
        return item;
      });

      return {
        ...prev,
        [column === 'chinese' ? 'chineseTasks' : 'englishTasks']: updatedList
      };
    });
  };

  // 手動新增作業項目
  const handleAddTask = (column, text) => {
    if (!text.trim()) return;
    const newTask = {
      id: `${column[0]}-${Date.now()}`,
      text: text.trim(),
      completed: false,
      isExam: false
    };

    setHomeworkData(prev => ({
      ...prev,
      [column === 'chinese' ? 'chineseTasks' : 'englishTasks']: [
        ...(column === 'chinese' ? prev.chineseTasks : prev.englishTasks),
        newTask
      ]
    }));
  };

  // 刪除作業項目
  const handleDeleteTask = (column, taskId) => {
    setHomeworkData(prev => ({
      ...prev,
      [column === 'chinese' ? 'chineseTasks' : 'englishTasks']: (
        column === 'chinese' ? prev.chineseTasks : prev.englishTasks
      ).filter(t => t.id !== taskId)
    }));
  };

  // 新增注意事項
  const handleAddNotice = (text, type = 'sign') => {
    if (!text.trim()) return;
    const newNotice = {
      id: `n-${Date.now()}`,
      text: text.trim(),
      type
    };
    setHomeworkData(prev => ({
      ...prev,
      notices: [...(prev.notices || []), newNotice]
    }));
  };

  // 刪除注意事項
  const handleDeleteNotice = (noticeId) => {
    setHomeworkData(prev => ({
      ...prev,
      notices: (prev.notices || []).filter(n => n.id !== noticeId)
    }));
  };

  // 家長拍照/上傳聯絡簿照片
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64Data = evt.target?.result;
      if (base64Data) {
        setPhotoPreview(base64Data);
        setHomeworkData(prev => ({
          ...prev,
          photoUrl: base64Data
        }));

        // 若有 API Key，自動觸發一次性辨識
        if (apiKey) {
          await analyzeHomeworkPhotoWithGemini(base64Data);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // 呼叫 Gemini 2.5 Flash Vision 進行零浪費聯絡簿照片結構化萃取
  const analyzeHomeworkPhotoWithGemini = async (base64String) => {
    if (!apiKey) {
      alert('請先在設定中輸入 Gemini API Key 以啟用智慧照片辨識');
      return;
    }

    setIsAnalyzingPhoto(true);
    setAnalysisError('');

    try {
      // 移除 data:image/xxx;base64, 前綴
      const cleanBase64 = base64String.replace(/^data:image\/\w+;base64,/, '');

      const promptText = `你是一位專業且細心的小學班級聯絡簿秘書。請仔細觀察這張手寫聯絡簿照片（包含中文欄與英文欄），結構化萃取出以下項目：
1. 日期（若有，例如 115年9月29日）
2. 中文與一般作業清單 (chineseTasks)：條列式，包含各項國語、數學、社會、週記等作業
3. 英文作業清單 (englishTasks)：條列式，包含英文 Review, Workbook, Spelling 等
4. 家長訂簽與特別注意事項 (notices)：特別抽離出含有「訂簽」、「帶OO物品」或回條的項目
5. 近期小考提醒 (upcomingExams)：凡作業中有提到「明考...」、「Spelling test tomorrow」或考試日期的項目，萃取出科目、範圍與日期

請嚴格輸出以下純 JSON 格式，不要包含額外說明或 markdown 標籤：
{
  "dateTaiwanStr": "115 年 9 月 29 日 (星期二)",
  "chineseTasks": [
    { "text": "1. 國修 L4 全" },
    { "text": "2. 國習 P28-30" }
  ],
  "englishTasks": [
    { "text": "1. Review U4S3 story P320" }
  ],
  "notices": [
    { "text": "✍️ 國乙本 L2, L4 訂簽", "type": "sign" },
    { "text": "🎒 明日記得攜帶：週記草稿本", "type": "bring" }
  ],
  "upcomingExams": [
    { "subject": "國語", "scope": "L4 圈詞 + 成語", "date": "2026-09-30" },
    { "subject": "English", "scope": "U4S3 Spelling Test", "date": "2026-09-30" }
  ]
}`;

      const model = 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: cleanBase64
                }
              }
            ]
          }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API 回傳錯誤: HTTP ${response.status}`);
      }

      const resData = await response.json();
      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('未能取得辨識內容');

      const parsed = JSON.parse(rawText);

      // 轉換為標準結構
      const updatedHomework = {
        ...homeworkData,
        dateTaiwanStr: parsed.dateTaiwanStr || homeworkData.dateTaiwanStr,
        chineseTasks: (parsed.chineseTasks || []).map((t, idx) => ({
          id: `c-${idx + 1}`,
          text: t.text,
          completed: false
        })),
        englishTasks: (parsed.englishTasks || []).map((t, idx) => ({
          id: `e-${idx + 1}`,
          text: t.text,
          completed: false
        })),
        notices: (parsed.notices || []).map((n, idx) => ({
          id: `n-${idx + 1}`,
          text: n.text,
          type: n.type || 'sign'
        }))
      };

      setHomeworkData(updatedHomework);
      saveHomeworkState(updatedHomework);

      if (parsed.upcomingExams && onExamsExtracted) {
        onExamsExtracted(parsed.upcomingExams.map((ex, i) => ({
          id: `ex-${Date.now()}-${i}`,
          subject: ex.subject,
          scope: ex.scope,
          date: ex.date,
          urgent: true
        })));
      }
    } catch (err) {
      console.error('照片辨識錯誤:', err);
      setAnalysisError(err.message || '辨識失敗，請檢查 API Key 或網路');
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  return (
    <section className="daily-contact-hub-card" aria-label="今日智慧聯絡簿看板">
      {/* 隱藏的檔案上傳輸入框 */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handlePhotoSelect} 
        accept="image/*" 
        style={{ display: 'none' }} 
      />

      {/* 看板頂部日期與狀態列 */}
      <div className="hub-header">
        <div className="hub-date-info">
          <span className="hub-calendar-icon">📅</span>
          <div>
            <h2 className="hub-date-title">{homeworkData.dateTaiwanStr || '今日聯絡簿'}</h2>
            <span className={`hub-status-tag ${activeDateInfo.isHoliday || activeDateInfo.isWeekend ? 'holiday-tag' : 'active'}`}>
              {activeDateInfo.note}
            </span>
          </div>
        </div>

        {/* 來源動作與照片按鈕 */}
        <div className="hub-source-action">
          {photoPreview && (
            <button 
              type="button" 
              className="btn-view-photo"
              onClick={() => onOpenLightbox && onOpenLightbox([photoPreview], 0)}
              title="點擊查看聯絡簿原圖"
            >
              <img src={photoPreview} alt="聯絡簿照片" className="contact-thumb" />
              <span>查看原圖</span>
            </button>
          )}

          <button 
            type="button" 
            className="btn-upload-photo"
            onClick={() => fileInputRef.current?.click()}
            title="拍照或上傳聯絡簿照片"
          >
            {isAnalyzingPhoto ? <Loader2 size={15} className="spinner-animate" /> : <Camera size={15} />}
            <span>{isAnalyzingPhoto ? 'AI 辨識中...' : '補拍聯絡簿'}</span>
          </button>

          <button 
            type="button" 
            className="btn-edit-manual"
            onClick={() => setIsEditing(!isEditing)}
            title="編輯作業清單"
          >
            <Edit3 size={15} />
            <span>{isEditing ? '完成' : '編輯清單'}</span>
          </button>
        </div>
      </div>

      {/* 辨識錯誤提示 */}
      {analysisError && (
        <div className="hub-alert-banner">
          <AlertTriangle size={16} />
          <span>{analysisError}</span>
        </div>
      )}

      {/* 作業 Checklist 雙欄本體 */}
      <div className="hub-body-grid">
        
        {/* 左欄：中文與一般作業 */}
        <div className="hub-column">
          <div className="column-header-row">
            <h3 className="column-subtitle">📘 中文與一般作業</h3>
            <span className="task-count-pill">
              {homeworkData.chineseTasks.filter(t => t.completed).length} / {homeworkData.chineseTasks.length} 完成
            </span>
          </div>

          <ul className="checklist-items">
            {homeworkData.chineseTasks.map(task => (
              <li key={task.id} className={`checklist-item ${task.completed ? 'completed' : ''}`}>
                <label className="custom-checkbox">
                  <input 
                    type="checkbox" 
                    checked={task.completed} 
                    onChange={() => handleToggleTask('chinese', task.id)}
                  />
                  <span className="checkmark">
                    {task.completed && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="task-text">{task.text}</span>
                </label>
                {isEditing && (
                  <button 
                    type="button" 
                    className="btn-del-task" 
                    onClick={() => handleDeleteTask('chinese', task.id)}
                    aria-label="刪除此項目"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {/* 編輯模式下可新增項目 */}
          {isEditing && (
            <div className="add-task-row">
              <input 
                type="text" 
                placeholder="新增中文/社會作業..." 
                className="input-inline full-w"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTask('chinese', e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* 右欄：English Assignments */}
        <div className="hub-column">
          <div className="column-header-row">
            <h3 className="column-subtitle">📙 English Assignments</h3>
            <span className="task-count-pill">
              {homeworkData.englishTasks.filter(t => t.completed).length} / {homeworkData.englishTasks.length} 完成
            </span>
          </div>

          <ul className="checklist-items">
            {homeworkData.englishTasks.map(task => (
              <li key={task.id} className={`checklist-item ${task.completed ? 'completed' : ''}`}>
                <label className="custom-checkbox">
                  <input 
                    type="checkbox" 
                    checked={task.completed} 
                    onChange={() => handleToggleTask('english', task.id)}
                  />
                  <span className="checkmark">
                    {task.completed && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="task-text">{task.text}</span>
                </label>
                {isEditing && (
                  <button 
                    type="button" 
                    className="btn-del-task" 
                    onClick={() => handleDeleteTask('english', task.id)}
                    aria-label="刪除此項目"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {/* 編輯模式下可新增項目 */}
          {isEditing && (
            <div className="add-task-row">
              <input 
                type="text" 
                placeholder="新增 English homework..." 
                className="input-inline full-w"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTask('english', e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>
          )}
        </div>

      </div>

      {/* 底部特別提醒區：家長訂簽與特別注意事項 (Notices & Signatures) */}
      <div className="hub-footer-notices">
        <div className="notice-tag-title">📌 家長訂簽與特別注意事項：</div>
        <div className="notice-chips">
          {homeworkData.notices.map(notice => (
            <span 
              key={notice.id} 
              className={`notice-badge ${notice.type === 'sign' ? 'red' : 'gray'}`}
            >
              <span>{notice.text}</span>
              {isEditing && (
                <button 
                  type="button" 
                  className="btn-del-notice" 
                  onClick={() => handleDeleteNotice(notice.id)}
                >
                  ×
                </button>
              )}
            </span>
          ))}

          {isEditing && (
            <input 
              type="text" 
              placeholder="新增訂簽提醒 (Enter)..." 
              className="input-inline notice-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddNotice(e.currentTarget.value, 'sign');
                  e.currentTarget.value = '';
                }
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
