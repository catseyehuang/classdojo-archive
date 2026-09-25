import React, { useState, useMemo } from 'react';
import { ExternalLink, Image as ImageIcon, FileText, Video, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { formatTaiwanDate, renderContentWithLinks } from '../utils';
import { resolveTeacherTheme } from '../teacherProfiles';

export default function PostCard({ post, teacherProfiles, onOpenImageLightbox }) {
  // 翻譯預設收合
  const [isTranslationOpen, setIsTranslationOpen] = useState(false);
  // 長文 clamp 展開/收合
  const [isTextExpanded, setIsTextExpanded] = useState(false);

  // 解析附件（相容 Supabase jsonb Array 或舊版 JSON 字串）
  const attachmentsList = useMemo(() => {
    if (!post.attachments) return [];
    if (Array.isArray(post.attachments)) return post.attachments;
    try {
      const parsed = JSON.parse(post.attachments);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to parse attachments JSON string:', e);
      return [];
    }
  }, [post.attachments]);

  // 教師個性化主題（規格書 7.4）
  const teacherInfo = useMemo(() => {
    return resolveTeacherTheme(post.author, teacherProfiles);
  }, [post.author, teacherProfiles]);

  const formattedDate = useMemo(() => formatTaiwanDate(post.created_at_taiwan), [post.created_at_taiwan]);

  // 輔助函式：判斷附件是否為圖片
  const checkIsImage = (att) => {
    if (att.type === 'photo') return true;
    if (att.filename && /\.(jpe?g|png|webp|gif|svg|bmp)$/i.test(att.filename)) return true;
    if (att.url && /\.(jpe?g|png|webp|gif|svg|bmp)(\?|$)/i.test(att.url)) return true;
    return false;
  };

  // 分離出圖片附件與非圖片附件
  const { photoAttachments, nonPhotoAttachments } = useMemo(() => {
    const photos = [];
    const others = [];

    attachmentsList.forEach((att, idx) => {
      let displayName = att.filename && att.filename !== 'Unknown' ? att.filename : '';
      if (!displayName) {
        if (checkIsImage(att)) displayName = `照片-${idx + 1}`;
        else if (att.type === 'video') displayName = `影片-${idx + 1}`;
        else if (att.type === 'link') displayName = att.url || '外部連結';
        else displayName = `檔案-${idx + 1}`;
      }
      const item = { ...att, filename: displayName, originalIndex: idx };
      if (checkIsImage(att)) {
        photos.push(item);
      } else {
        others.push(item);
      }
    });

    return { photoAttachments: photos, nonPhotoAttachments: others };
  }, [attachmentsList]);

  // 判斷內文是否過長（簡易判斷超過 8 行或 300 字）
  const content = post.content_raw ? post.content_raw.trim() : '';
  const isLongText = useMemo(() => {
    if (!content) return false;
    const lines = content.split('\n').length;
    return lines > 8 || content.length > 280;
  }, [content]);

  // 角色中文標籤（僅使用者有明確設定時顯示）
  const roleLabel = useMemo(() => {
    if (teacherInfo.role === 'local') return '中師';
    if (teacherInfo.role === 'foreign') return '外師';
    if (teacherInfo.role === 'other') return '專任';
    return null;
  }, [teacherInfo.role]);

  // 圖片網格點擊
  const handlePhotoClick = (index) => {
    if (onOpenImageLightbox && photoAttachments.length > 0) {
      onOpenImageLightbox(photoAttachments, index);
    }
  };

  // 圖片網格最多顯示 5 張
  const visiblePhotosCount = Math.min(photoAttachments.length, 5);
  const extraPhotosCount = photoAttachments.length - 5;

  const { solid, soft, ink } = teacherInfo.themeTokens;

  return (
    <article 
      className="post-card" 
      id={`post-${post.post_id}`}
      data-teacher-theme={teacherInfo.theme}
      style={{
        '--t-solid': solid,
        '--t-soft': soft,
        '--t-ink': ink
      }}
    >
      {/* 標頭資訊 */}
      <div className="post-header">
        <div className="post-header-left">
          {/* A: 頭像（雙層環繞描邊 + 首字母） */}
          <div className="teacher-avatar" aria-label={`教師頭像：${teacherInfo.displayName}`}>
            {teacherInfo.initial}
          </div>
          <div className="post-meta">
            <div className="post-author-row">
              <span className="post-author">{teacherInfo.displayName}</span>
              {/* C: 角色標籤 */}
              {roleLabel && (
                <span className="teacher-role-badge">
                  {roleLabel}
                </span>
              )}
            </div>
            <time className="post-date" dateTime={post.created_at_taiwan}>
              {formattedDate}
            </time>
          </div>
        </div>
        {/* 班級標籤 */}
        {post.class_name && (
          <span className="post-grade-badge">
            {post.class_name}
          </span>
        )}
      </div>

      {/* 貼文內文（若無文字則不渲染空白區） */}
      {content.length > 0 && (
        <div className="post-body-container">
          <div className={`post-body ${!isTextExpanded && isLongText ? 'clamped' : ''}`}>
            {renderContentWithLinks(content)}
          </div>
          {isLongText && (
            <button
              type="button"
              className="text-expand-btn"
              onClick={() => setIsTextExpanded(!isTextExpanded)}
            >
              <span>{isTextExpanded ? '收合全文 ▴' : '展開全文 ▾'}</span>
            </button>
          )}
        </div>
      )}

      {/* 7.1.2 附件圖片直接預覽 (Facebook 風格網格，緊接在正文後、翻譯前) */}
      {photoAttachments.length > 0 && (
        <div 
          className="media-grid" 
          data-count={visiblePhotosCount}
          role="group" 
          aria-label={`附件圖片，共 ${photoAttachments.length} 張`}
        >
          {photoAttachments.slice(0, visiblePhotosCount).map((photo, idx) => {
            const isLast = idx === 4 && extraPhotosCount > 0;
            return (
              <button
                key={idx}
                type="button"
                className={`media-item ${isLast ? 'has-more' : ''}`}
                data-more={isLast ? `+${extraPhotosCount + 1}` : undefined}
                onClick={() => handlePhotoClick(idx)}
                aria-label={`查看照片 ${idx + 1}`}
              >
                <img
                  src={photo.url}
                  alt={photo.filename || `貼文圖片 ${idx + 1}`}
                  loading="lazy"
                  decoding="async"
                  onLoad={(e) => e.currentTarget.classList.add('is-loaded')}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement.classList.add('img-error');
                  }}
                />
              </button>
            );
          })}
        </div>
      )}

      {/* 非圖片附件列表 */}
      {nonPhotoAttachments.length > 0 && (
        <div className="non-photo-attachments-list">
          {nonPhotoAttachments.map((att, idx) => {
            const isLink = att.type === 'link';
            const isFile = att.type === 'file';
            const isVideo = att.type === 'video';

            return (
              <a
                key={idx}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="non-photo-attachment-item"
                title={`在新分頁開啟：${att.filename}`}
              >
                <div className="attachment-icon-wrap">
                  {isVideo && <Video size={16} />}
                  {isFile && <FileText size={16} />}
                  {isLink && <ExternalLink size={16} />}
                </div>
                <span className="attachment-name">{att.filename}</span>
                <span className="attachment-action-text">開啟 ↗</span>
              </a>
            );
          })}
        </div>
      )}

      {/* 7.1.3 英文翻譯內容（預設收合） */}
      {post.translation && post.translation.trim().length > 0 && (
        <div className="post-translation-container">
          <button
            type="button"
            className={`translation-toggle-btn ${isTranslationOpen ? 'expanded' : ''}`}
            onClick={() => setIsTranslationOpen(!isTranslationOpen)}
            aria-expanded={isTranslationOpen}
          >
            <div className="translation-btn-left">
              <Globe size={13} className="translation-icon" />
              <span>{isTranslationOpen ? '收合英文翻譯 ▴' : '🌐 顯示英文翻譯 ▾'}</span>
            </div>
            {isTranslationOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {isTranslationOpen && (
            <div className="post-translation-box">
              <div className="translation-header">
                <Globe size={12} className="globe-icon" />
                <span>翻譯（譯文）</span>
              </div>
              <div className="translation-body">
                {renderContentWithLinks(post.translation)}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
