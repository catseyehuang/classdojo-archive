import React, { useState } from 'react';
import { Calendar as CalendarIcon, ExternalLink, Image as ImageIcon, ChevronRight } from 'lucide-react';
import { GRADE_3_CALENDAR_EVENTS, formatDateKey } from '../utils/homeworkEngine';

export default function SchoolCalendarStrip({ onOpenCalendarModal }) {
  const [events, setEvents] = useState(GRADE_3_CALENDAR_EVENTS);
  const todayStr = formatDateKey(new Date());

  // 計算距離天數
  const getDaysLeft = (eventDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(eventDate);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: '已結束', status: 'past' };
    if (diffDays === 0) return { label: '今日進行中', status: 'today' };
    return { label: `倒數 ${diffDays} 天`, status: 'future' };
  };

  // 取得未來或今日的重要事件（排除國定連假與補假，專注於學校活動、評量與考查）
  const upcomingEvents = events
    .filter(e => {
      // 連假不用放進去
      if (e.type === 'holiday') return false;
      return e.date >= todayStr || getDaysLeft(e.date).status !== 'past';
    })
    .slice(0, 8);

  return (
    <section className="school-calendar-strip" aria-label="三年級行事曆大事記">
      <div className="strip-header">
        <div className="strip-title-group">
          <span className="strip-icon">🏫</span>
          <h3 className="strip-title">115 上學期三年級行事曆大事記</h3>
          <span className="strip-badge">育才雙語小學</span>
        </div>
        <button 
          type="button" 
          className="btn-link-photo"
          onClick={onOpenCalendarModal}
          title="查看官方完整行事曆"
        >
          <ImageIcon size={15} />
          <span>查看官方行事曆原圖</span>
          <ExternalLink size={13} />
        </button>
      </div>

      <div className="events-horizontal-scroll">
        {upcomingEvents.map(event => {
          const daysInfo = getDaysLeft(event.date);
          const isMajorExam = event.type.includes('exam-major');
          const isHoliday = event.type === 'holiday';

          let cardClass = 'event-card';
          if (isMajorExam) cardClass += ' exam-major';
          else if (event.type.includes('exam')) cardClass += ' exam';
          else if (isHoliday) cardClass += ' holiday';

          return (
            <div key={event.id} className={cardClass}>
              <div className="event-date-row">
                <span className="event-date">{event.date.slice(5)}</span>
                <span className={`event-days-left ${daysInfo.status}`}>
                  {daysInfo.label}
                </span>
              </div>
              <span className="event-name" title={event.name}>{event.name}</span>
              <span className="event-target-tag">{event.target}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
