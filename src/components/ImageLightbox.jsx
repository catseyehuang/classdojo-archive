import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, ExternalLink, Download, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ImageLightbox({ images = [], initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartX = useRef(null);

  const total = images.length;
  const currentImage = images[currentIndex] || {};
  const imageUrl = currentImage.url || '';
  const imageName = currentImage.filename && currentImage.filename !== 'Unknown' 
    ? currentImage.filename 
    : `照片附件 ${currentIndex + 1}`;

  // 下一張
  const handleNext = useCallback((e) => {
    if (e) e.stopPropagation();
    if (total > 1) {
      setCurrentIndex((prev) => (prev + 1) % total);
    }
  }, [total]);

  // 上一張
  const handlePrev = useCallback((e) => {
    if (e) e.stopPropagation();
    if (total > 1) {
      setCurrentIndex((prev) => (prev - 1 + total) % total);
    }
  }, [total]);

  // 鍵盤監聽 (ESC, ArrowLeft, ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // 鎖定背景捲動
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    // history.pushState 整合（讓手機返回鍵只關閉燈箱）
    window.history.pushState({ lightbox: true }, '');
    const handlePopState = () => {
      onClose();
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [onClose, handleNext, handlePrev]);

  // 觸控手勢滑動 (Touch Swipe)
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (diff > 50) {
      handleNext();
    } else if (diff < -50) {
      handlePrev();
    }
    touchStartX.current = null;
  };

  // 在新分頁開啟原圖 (保留原 R2 URL)
  const handleOpenExternal = (e) => {
    e.stopPropagation();
    if (imageUrl) {
      window.open(imageUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // 下載當前圖片
  const handleDownload = (e) => {
    e.stopPropagation();
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = currentImage.filename || `classdojo-photo-${currentIndex + 1}.jpg`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!currentImage || !imageUrl) return null;

  return (
    <div 
      className="lightbox-backdrop" 
      onClick={onClose} 
      role="dialog" 
      aria-modal="true" 
      aria-label="圖片預覽燈箱"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 頂部工具列 */}
      <div className="lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-title-area">
          <span className="lightbox-badge">照片附件</span>
          <span className="lightbox-title" title={imageName}>{imageName}</span>
          {total > 1 && (
            <span className="lightbox-counter">
              {currentIndex + 1} / {total}
            </span>
          )}
        </div>
        <div className="lightbox-actions">
          {imageUrl && (
            <button
              type="button"
              className="lightbox-action-btn primary"
              onClick={handleOpenExternal}
              title="在新分頁檢視原始高清檔案"
            >
              <ExternalLink size={15} />
              <span className="desktop-only-text">另開新視窗</span>
            </button>
          )}
          {imageUrl && (
            <button
              type="button"
              className="lightbox-action-btn secondary"
              onClick={handleDownload}
              title="下載圖片"
              aria-label="下載圖片"
            >
              <Download size={15} />
            </button>
          )}
          <button
            type="button"
            className="lightbox-action-btn close-btn"
            onClick={onClose}
            aria-label="關閉預覽 (ESC)"
            title="關閉 (ESC)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 圖片展示主體與左右導航按鈕 */}
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {total > 1 && (
          <button 
            type="button"
            className="lightbox-nav-btn prev"
            onClick={handlePrev}
            aria-label="上一張圖片"
            title="上一張 (←)"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        <div className="lightbox-image-wrapper">
          <img
            key={imageUrl}
            src={imageUrl}
            alt={imageName}
            className="lightbox-image"
            onError={(e) => {
              e.currentTarget.alt = '圖片無法載入或連結已失效';
            }}
          />
        </div>

        {total > 1 && (
          <button 
            type="button"
            className="lightbox-nav-btn next"
            onClick={handleNext}
            aria-label="下一張圖片"
            title="下一張 (→)"
          >
            <ChevronRight size={28} />
          </button>
        )}

        {/* 底部浮動快速按鈕 */}
        <div className="lightbox-bottom-bar">
          <button 
            type="button" 
            className="lightbox-external-bottom-btn"
            onClick={handleOpenExternal}
          >
            <ExternalLink size={14} />
            <span>在新分頁檢視原始高清檔案 (Cloudflare R2)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
