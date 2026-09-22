import React, { useMemo } from 'react';
import { ExternalLink, Image, FileText, Video, Globe } from 'lucide-react';
import { formatTaiwanDate, renderContentWithLinks } from '../utils';

export default function PostCard({ post }) {
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

      {/* 所有附件區塊 (照片、連結、檔案、影片皆在此處統一渲染為非點擊樣式) */}
      {attachmentsList.length > 0 && (
        <div className="post-attachments" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
          {attachmentsList.map((att, idx) => {
            const isPhoto = att.type === 'photo';
            const isLink = att.type === 'link';
            const isFile = att.type === 'file';
            const isVideo = att.type === 'video';

            let displayName = att.filename && att.filename !== 'Unknown' ? att.filename : '';
            if (!displayName) {
              if (isPhoto) displayName = `照片-${idx + 1}`;
              else if (isVideo) displayName = `影片-${idx + 1}`;
              else if (isLink) displayName = att.url || '外部連結';
              else displayName = `檔案-${idx + 1}`;
            }

            // 判斷是否為 Cloudflare R2 永久可用網址
            const isR2Url = att.url && (att.url.includes('.r2.dev') || att.url.includes('.r2.cloudflarestorage.com') || att.url.includes('jojociao.me'));

            if (isLink) {
              return (
                <div 
                  key={idx} 
                  className="btn-link-attachment-disabled"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.82rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#64748b', cursor: 'default' }}
                >
                  <ExternalLink size={14} />
                  <span>{displayName}</span>
                </div>
              );
            }

            // 若為 R2 永久網址，提供可點擊新分頁檢視 / 下載
            if (isR2Url) {
              return (
                <a
                  key={idx}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tag-media-attachment-active"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    fontSize: '0.82rem',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    color: '#1d4ed8',
                    textDecoration: 'none',
                    fontWeight: 500,
                    transition: 'all 0.15s ease'
                  }}
                  title="點擊在新分頁開啟原始檔案 (Cloudflare R2)"
                >
                  {isPhoto && <Image size={14} style={{ color: '#2563eb' }} />}
                  {isFile && <FileText size={14} style={{ color: '#2563eb' }} />}
                  {isVideo && <Video size={14} style={{ color: '#2563eb' }} />}
                  <span>{displayName} (R2)</span>
                  <ExternalLink size={11} style={{ opacity: 0.7 }} />
                </a>
              );
            }

            // 歷史 AWS CloudFront 暫時性簽名過期附件：維持安全非點擊標籤
            return (
              <div 
                key={idx} 
                className="tag-media-attachment-disabled"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', fontSize: '0.82rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', color: '#64748b', cursor: 'default' }}
                title="歷史過期附件 (非永久存檔)"
              >
                {isPhoto && <Image size={13} style={{ color: '#0ea5e9' }} />}
                {isFile && <FileText size={13} style={{ color: '#64748b' }} />}
                {isVideo && <Video size={13} style={{ color: '#64748b' }} />}
                <span>{displayName}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
