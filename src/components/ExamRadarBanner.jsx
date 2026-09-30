import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export default function ExamRadarBanner({ exams = [], onUpdateExams }) {
  const [examList, setExamList] = useState(exams);
  const [isAdding, setIsAdding] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newScope, setNewScope] = useState('');
  const [newDate, setNewDate] = useState('');

  // 取得今天 YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  // 自動過濾已過去的小考 (小考當天結束過後自動從提醒區移除)
  const activeExams = examList.filter(item => {
    if (!item.date) return true;
    return item.date >= todayStr;
  });

  useEffect(() => {
    setExamList(exams);
  }, [exams]);

  const handleRemove = (id) => {
    const updated = examList.filter(e => e.id !== id);
    setExamList(updated);
    if (onUpdateExams) onUpdateExams(updated);
  };

  const handleAddExam = (e) => {
    e.preventDefault();
    if (!newSubject.trim() || !newScope.trim()) return;

    const newItem = {
      id: `ex-${Date.now()}`,
      subject: newSubject.trim(),
      scope: newScope.trim(),
      date: newDate || todayStr,
      urgent: newDate === todayStr
    };

    const updated = [...examList, newItem];
    setExamList(updated);
    if (onUpdateExams) onUpdateExams(updated);

    setNewSubject('');
    setNewScope('');
    setNewDate('');
    setIsAdding(false);
  };

  if (activeExams.length === 0 && !isAdding) {
    return null; // 無近期小考時隱藏
  }

  return (
    <section className="exam-radar-banner" aria-label="本週小考提醒">
      <div className="radar-header">
        <div className="radar-title-group">
          <span className="radar-pulse-dot"></span>
          <span className="radar-title">🚨 本週小考提醒 (Exam Radar)</span>
          <span className="radar-count-tag">{activeExams.length} 個待考科目</span>
        </div>
        <button 
          type="button" 
          className="btn-add-exam-mini"
          onClick={() => setIsAdding(!isAdding)}
          title="手動新增小考"
        >
          <Plus size={14} />
          <span>{isAdding ? '收起' : '手動補登小考'}</span>
        </button>
      </div>

      {/* 新增小考表單 */}
      {isAdding && (
        <form onSubmit={handleAddExam} className="add-exam-inline-form">
          <input 
            type="text" 
            placeholder="科目 (例: 國語 / English)" 
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            className="input-inline"
            required
          />
          <input 
            type="text" 
            placeholder="考試範圍 (例: L4 圈詞 + 成語)" 
            value={newScope}
            onChange={(e) => setNewScope(e.target.value)}
            className="input-inline"
            required
          />
          <input 
            type="date" 
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="input-inline date-input"
          />
          <button type="submit" className="btn-confirm-add">新增</button>
        </form>
      )}

      {/* 小考 Chips 清單 */}
      <div className="exam-chips-grid">
        {activeExams.map((exam) => {
          const isToday = exam.date === todayStr;
          return (
            <div key={exam.id} className={`exam-chip ${isToday ? 'urgent' : ''}`}>
              <div className="exam-chip-content">
                <span className="exam-date-badge">
                  {isToday ? '今日考試' : exam.date ? exam.date.slice(5) : '近期'}
                </span>
                <span className="exam-subject">{exam.subject}</span>
                <span className="exam-scope">{exam.scope}</span>
              </div>
              <button 
                type="button"
                className="btn-dismiss-exam"
                onClick={() => handleRemove(exam.id)}
                title="已考完/移除提醒"
                aria-label="移除小考"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
