import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function Calendar({ posts, selectedDate, onSelectDate }) {
  // 找出貼文中所有包含貼文的台灣日期，格式為 YYYY-MM-DD
  const postDates = useMemo(() => {
    const dates = new Set();
    posts.forEach(post => {
      if (post.created_at_taiwan) {
        const datePart = post.created_at_taiwan.split(' ')[0]; // 提取 "2026-06-26"
        dates.add(datePart);
      }
    });
    return dates;
  }, [posts]);

  // 以最新貼文的日期，或今日，做為日曆的初始月份
  const initialDate = useMemo(() => {
    if (selectedDate) return new Date(selectedDate);
    if (posts.length > 0 && posts[0].created_at_taiwan) {
      return new Date(posts[0].created_at_taiwan.split(' ')[0]);
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

  // 年份範圍（從資料中提取的年份，或預設 2023-2027）
  const years = useMemo(() => {
    const uniqueYears = new Set();
    posts.forEach(post => {
      if (post.created_at_taiwan) {
        const yr = new Date(post.created_at_taiwan.split(' ')[0]).getFullYear();
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
    // 該月第一天是星期幾 (0-6)
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    // 該月總天數
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    // 前一個月的總天數（用於補齊前置空格）
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
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <select 
            value={currentYear} 
            onChange={(e) => setCurrentYear(parseInt(e.target.value))}
            className="calendar-month-select"
            style={{ padding: '2px 4px', border: '1px solid #e2e8f0', borderRadius: '4px', background: 'white' }}
          >
            {years.map(yr => (
              <option key={yr} value={yr}>{yr}年</option>
            ))}
          </select>
          <select 
            value={currentMonth} 
            onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
            className="calendar-month-select"
            style={{ padding: '2px 4px', border: '1px solid #e2e8f0', borderRadius: '4px', background: 'white' }}
          >
            {months.map((m, idx) => (
              <option key={idx} value={idx}>{m}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={handlePrevMonth} className="calendar-nav-btn" aria-label="上一月">
            <ChevronLeft size={16} />
          </button>
          <button onClick={handleNextMonth} className="calendar-nav-btn" aria-label="下一月">
            <ChevronRight size={16} />
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
          const hasPost = postDates.has(cell.dateStr);
          const isSelected = selectedDate === cell.dateStr;
          const isToday = todayStr === cell.dateStr;
          
          return (
            <button
              key={idx}
              onClick={() => onSelectDate(cell.dateStr)}
              className={`calendar-day ${!cell.isCurrentMonth ? 'other-month' : ''} ${hasPost ? 'has-post' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {/* 清除選擇按鈕 */}
      {selectedDate && (
        <button className="calendar-clear-btn" onClick={() => onSelectDate(null)}>
          <X size={12} /> 清除日期篩選
        </button>
      )}
    </div>
  );
}
