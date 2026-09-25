import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { resolveTeacherTheme } from '../teacherProfiles';

const getDatePart = (dateStr) => {
  if (!dateStr) return '';
  return dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
};

export default function Calendar({ posts, selectedDate, onSelectDate, teacherProfiles }) {
  // 統計每日發文的所有教師主題色
  const dateTeachersMap = useMemo(() => {
    const map = new Map();
    posts.forEach(post => {
      if (post.created_at_taiwan) {
        const datePart = getDatePart(post.created_at_taiwan);
        if (!map.has(datePart)) {
          map.set(datePart, new Map());
        }
        const teachersInDay = map.get(datePart);
        if (post.author) {
          const themeInfo = resolveTeacherTheme(post.author, teacherProfiles);
          teachersInDay.set(post.author, themeInfo.themeTokens.solid);
        }
      }
    });
    return map;
  }, [posts, teacherProfiles]);

  // 以最新貼文的日期，或今日，做為日曆的初始月份
  const initialDate = useMemo(() => {
    if (selectedDate) return new Date(selectedDate);
    if (posts.length > 0 && posts[0].created_at_taiwan) {
      return new Date(getDatePart(posts[0].created_at_taiwan));
    }
    return new Date();
  }, [posts, selectedDate]);

  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth()); // 0-11

  // 月份選單
  const months = [
    '1月', '2月', '3月', '4月', '5月', '6月', 
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];

  // 年份範圍
  const years = useMemo(() => {
    const uniqueYears = new Set();
    posts.forEach(post => {
      if (post.created_at_taiwan) {
        const yr = new Date(getDatePart(post.created_at_taiwan)).getFullYear();
        if (!isNaN(yr)) uniqueYears.add(yr);
      }
    });
    const result = Array.from(uniqueYears).sort((a, b) => b - a);
    if (result.length === 0) {
      return [2026, 2025, 2024, 2023];
    }
    return result;
  }, [posts]);

  // 切換月份
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // 生成日曆的日期格
  const calendarCells = useMemo(() => {
    const cells = [];
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthTotalDays = new Date(currentYear, currentMonth, 0).getDate();

    // 補足前一個月的尾端日期
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthTotalDays - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      cells.push({
        day: dayNum,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
        dateStr: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      });
    }

    // 填充當月的日期
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      cells.push({
        day: dayNum,
        month: currentMonth,
        year: currentYear,
        isCurrentMonth: true,
        dateStr: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      });
    }

    // 補齊剩餘表格空間，使日曆為完整的 6 行 (42 格)
    const remainingCells = 42 - cells.length;
    for (let dayNum = 1; dayNum <= remainingCells; dayNum++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      cells.push({
        day: dayNum,
        month: nextMonth,
        year: nextYear,
        isCurrentMonth: false,
        dateStr: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      });
    }

    return cells;
  }, [currentYear, currentMonth]);

  const todayStr = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, []);

  return (
    <div className="calendar-container">
      {/* 頂部導覽列 */}
      <div className="calendar-header-nav">
        <div className="calendar-select-group">
          <select 
            value={currentYear} 
            onChange={(e) => setCurrentYear(parseInt(e.target.value))}
            className="calendar-month-select"
            aria-label="選擇年份"
          >
            {years.map(yr => (
              <option key={yr} value={yr}>{yr} 年</option>
            ))}
          </select>
          <select 
            value={currentMonth} 
            onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
            className="calendar-month-select"
            aria-label="選擇月份"
          >
            {months.map((m, idx) => (
              <option key={idx} value={idx}>{m}</option>
            ))}
          </select>
        </div>
        <div className="calendar-nav-buttons">
          <button onClick={handlePrevMonth} className="calendar-nav-btn" aria-label="上一月" title="上一月">
            <ChevronLeft size={18} />
          </button>
          <button onClick={handleNextMonth} className="calendar-nav-btn" aria-label="下一月" title="下一月">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* 星期標籤 */}
      <div className="calendar-grid">
        {['日', '一', '二', '三', '四', '五', '六'].map((day, idx) => (
          <div key={idx} className="calendar-day-label">{day}</div>
        ))}

        {/* 日期格子 */}
        {calendarCells.map((cell, idx) => {
          const teachersMap = dateTeachersMap.get(cell.dateStr);
          const hasPost = !!teachersMap && teachersMap.size > 0;
          const isSelected = selectedDate === cell.dateStr;
          const isToday = todayStr === cell.dateStr;
          
          // 提取該日發文的教師色點（最多 3 點）
          const colorDots = teachersMap ? Array.from(teachersMap.values()).slice(0, 3) : [];
          const hasMoreDots = teachersMap && teachersMap.size > 3;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectDate(cell.dateStr)}
              className={`calendar-day ${!cell.isCurrentMonth ? 'other-month' : ''} ${hasPost ? 'has-post' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
              title={hasPost ? `${cell.dateStr} (有貼文)` : cell.dateStr}
            >
              <span className="calendar-day-number">{cell.day}</span>
              {/* 教師色彩圓點 */}
              {hasPost && !isSelected && (
                <div className="calendar-dots-container">
                  {colorDots.map((color, dotIdx) => (
                    <span 
                      key={dotIdx} 
                      className="calendar-teacher-dot" 
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  {hasMoreDots && <span className="calendar-more-dot">+</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 清除選擇按鈕 */}
      {selectedDate && (
        <button className="calendar-clear-btn" onClick={() => onSelectDate(null)}>
          <X size={12} /> 清除日期篩選 ({selectedDate})
        </button>
      )}
    </div>
  );
}
