import React, { useState, useMemo } from 'react';
import { ExternalLink, Image, FileText, Video, Globe, X } from 'lucide-react';
import { formatTaiwanDate, renderContentWithLinks } from '../utils';

export default function PostCard({ post }) {
  const [previewImage, setPreviewImage] = useState(null);

  // 解析附件 JSON 字串
  const attachmentsList = useMemo(() => {
    if (!post.attachments) return [];
    try {
      const parsed = JSON.parse(post.attachments);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to parse attachments JSON string:', e);
      return [];
    }
  }, [post.attachments]);

  // 將照片附件與其他附件分離
  const photoAttachments = useMemo(() => {
    return attachmentsList.filter(att => att.type === 'photo');
  }, [attachmentsList]);

  const otherAttachments = useMemo(() => {
    return attachmentsList.filter(att => att.type !== 'photo');
  }, [attachmentsList]);

  // 依據不同教師返回對應的 card class
  const getTeacherCardClass = (author) => {
    if (author === 'Teacher Adam') return 'teacher-adam';
    if (author === 'Teacher Patty') return 'teacher-patty';
    return 'teacher-default';
  };

  // 獲取教師頭像的視覺配置
  const getTeacherAvatarInfo = (author) => {
    if (author === 'Teacher Adam') {
      return {
        initial: 'A',
        bg: '#dbeafe',
        color: '#1e40af',
        border: '#3b82f6'
      };
    }
    if (author === 'Teacher Patty') {
      return {
        initial: 'P',
        bg: '#d1fae5',
        color: '#065f46',
        border: '#10b981'
      };
    }
    return {
      initial: 'T',
      bg: '#f1f5f9',
      color: '#475569',
      border: '#94a3b8'
    };
  };

  const avatarInfo = useMemo(() => getTeacherAvatarInfo(post.author), [post.author]);
  const formattedDate = useMemo(() => formatTaiwanDate(post.created_at_taiwan), [post.created_at_taiwan]);

  return (
    <div className={`post-card ${getTeacherCardClass(post.author)}`} id={`post-${post.post_id}`}>
      {/* 標頭資訊 */}
      <div className="post-header">
        <div className="post-header-left">
          {/* 教師頭像 */}
          <div 
            className="teacher-avatar" 
            style={{ 
              backgroundColor: avatarInfo.bg, 
              color: avatarInfo.color, 
              border: `1.5px solid ${avatarInfo.border}` 
            }}
          >
            {avatarInfo.initial}
          </div>
          <div className="post-meta">
            <span className="post-author">{post.author || '未知老師'}</span>
            <span className="post-date">{formattedDate}</span>
          </div>
        </div>
        {/* 班級標籤 (右上角，淺綠色) */}
        {post.class_name && (
          <span className="post-grade-badge" style={{ backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
            {post.class_name}
          </span>
        )}
      </div>

      {/* 貼文內文 */}
      <div className="post-body">
        {renderContentWithLinks(post.content_raw)}
      </div>

      {/* 翻譯內容 */}
      {post.translation && post.translation.trim().length > 0 && (
        <div className="post-translation">
          <span className="translation-label">
            <Globe size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            翻譯 (譯文)：
          </span>
          {renderContentWithLinks(post.translation)}
        </div>
      )}

      {/* 圖片行內預覽圖網格 (多媒體附件直接預覽) */}
      {photoAttachments.length > 0 && (
        <div className="photo-thumbnails-grid">
          {photoAttachments.map((att, idx) => {
            const displayName = att.filename && att.filename !== 'Unknown' 
              ? att.filename 
              : `照片-${idx + 1}`;
            return (
              <div 
                key={idx} 
                className="photo-thumbnail-container"
                onClick={() => { if (att.url) setPreviewImage(att.url); }}
                title="點擊放大圖片"
              >
                <img src={att.url} alt={displayName} className="photo-thumbnail-img" />
                <div className="photo-thumbnail-overlay">
                  <Image size={16} />
                  <span>放大預覽</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 其他類型附件區塊 (連結、檔案、影片) */}
      {otherAttachments.length > 0 && (
        <div className="post-attachments">
          {otherAttachments.map((att, idx) => {
            const isLink = att.type === 'link';
            const isFile = att.type === 'file';
            const isVideo = att.type === 'video';

            const displayName = att.filename && att.filename !== 'Unknown' 
              ? att.filename 
              : `${isVideo ? '影片' : '檔案'}-${idx + 1}`;

            if (isLink) {
              return (
                <a 
                  key={idx} 
                  href={att.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn-link-attachment"
                  title="開啟外部連結"
                >
                  <ExternalLink size={14} />
                  <span>{att.filename || '外部連結'}</span>
                </a>
              );
            }

            return (
              <a 
                key={idx} 
                href={att.url || '#'} 
                target={att.url ? "_blank" : "_self"} 
                rel="noopener noreferrer" 
                className="tag-media-attachment"
                title={att.url ? "下載/檢視附件" : ""}
                onClick={(e) => { if (!att.url) e.preventDefault(); }}
              >
                {isFile && <FileText size={13} style={{ color: '#4f46e5' }} />}
                {isVideo && <Video size={13} style={{ color: '#b91c1c' }} />}
                <span>{displayName}</span>
              </a>
            );
          })}
        </div>
      )}

      {/* 圖片預覽彈出式視窗 (Lightbox Overlay) */}
      {previewImage && (
        <div className="image-modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="image-modal-close" onClick={() => setPreviewImage(null)}>
              <X size={24} />
            </button>
            <img src={previewImage} alt="圖片預覽" className="image-modal-img" />
          </div>
        </div>
      )}
    </div>
  );
}
