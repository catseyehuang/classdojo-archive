import React from 'react';

/**
 * 將台灣時間格式化為 "YYYY年M月D日 HH:mm" 的形式
 * 支援輸入格式如 "2026-06-26 15:30:12.820000+08:00"
 */
export function formatTaiwanDate(dateStr) {
  if (!dateStr) return '';
  try {
    const cleanedStr = dateStr.replace(' ', 'T');
    const date = new Date(cleanedStr);
    
    if (isNaN(date.getTime())) {
      // 若原生的 Date 解析失敗，改用手動切割字串的後備方案
      const parts = dateStr.split(' ');
      if (parts.length >= 2) {
        const datePart = parts[0]; // "2026-06-26"
        const timePart = parts[1]; // "15:30:12"
        const ymd = datePart.split('-');
        const hms = timePart.split(':');
        if (ymd.length === 3 && hms.length >= 2) {
          const year = parseInt(ymd[0], 10);
          const month = parseInt(ymd[1], 10);
          const day = parseInt(ymd[2], 10);
          const hour = hms[0];
          const minute = hms[1];
          return `${year}年${month}月${day}日 ${hour}:${minute}`;
        }
      }
      return dateStr;
    }
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}年${month}月${day}日 ${hours}:${minutes}`;
  } catch (e) {
    console.error('Error formatting date:', e);
    return dateStr;
  }
}

/**
 * 自動將文字中的 http/https 連結轉為 <a> 超連結
 */
export function renderContentWithLinks(text) {
  if (!text) return '';
  // 匹配網址的正規表達式
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a key={index} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      );
    }
    return part;
  });
}
