import React from 'react';
import { Lock, ShieldAlert, LogOut, CheckCircle2, User } from 'lucide-react';

export default function AuthGate({ 
  authLoading, 
  user, 
  isAuthorized, 
  authError, 
  onSignInWithGoogle, 
  onSignOut 
}) {
  if (authLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-card">
          <div className="auth-spinner"></div>
          <p className="auth-loading-text">正在驗證 Google 帳號身分與存取授權...</p>
        </div>
      </div>
    );
  }

  // 1. 未登入狀態
  if (!user) {
    return (
      <div className="auth-gate-overlay">
        <div className="auth-modal-card">
          <div className="auth-header">
            <div className="auth-icon-badge">
              <Lock size={28} className="lock-icon" />
            </div>
            <h2 className="auth-title">ClassDojo 聯絡簿檔案庫</h2>
            <div className="auth-privacy-pill">
              <CheckCircle2 size={13} />
              <span>機密家庭聯絡簿・白名單保護中</span>
            </div>
          </div>

          <div className="auth-body">
            <p className="auth-description">
              本系統封存了歷年班級通訊、學生作業與活動動態。為保護個人隱私，僅限已授權之家長與教師 Google 帳號存取。
            </p>

            <button 
              className="google-sign-in-btn" 
              onClick={onSignInWithGoogle}
              type="button"
            >
              <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>使用 Google 帳號登入</span>
            </button>
          </div>

          <div className="auth-footer">
            <span>Powered by Supabase Auth & Cloudflare</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. 已登入但不在白名單
  if (!isAuthorized) {
    return (
      <div className="auth-gate-overlay">
        <div className="auth-modal-card unauthorized-card">
          <div className="auth-header">
            <div className="auth-icon-badge danger">
              <ShieldAlert size={28} className="danger-icon" />
            </div>
            <h2 className="auth-title">存取權限受限</h2>
            <div className="user-email-badge">
              <User size={14} />
              <span>{user.email}</span>
            </div>
          </div>

          <div className="auth-body">
            <div className="unauthorized-alert">
              <p>您的 Google 帳號尚未列入 ClassDojo 聯絡簿的白名單許可名單中。</p>
              {authError && <p className="error-subtext">{authError}</p>}
            </div>

            <p className="auth-description">
              若您是學生家長或授權人員，請聯繫管理員協助將您的 Email 新增至白名單。
            </p>

            <button 
              className="sign-out-btn full-width" 
              onClick={onSignOut}
              type="button"
            >
              <LogOut size={16} />
              <span>切換其他 Google 帳號 / 登出</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
