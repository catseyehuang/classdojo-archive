# ClassDojo 歷史紀錄存檔檢視器 (ClassDojo Archive Viewer)

這是一個基於 **React 19 + Vite 8** 建立的現代化雲端原生單頁應用程式（SPA），專為瀏覽、檢索與分析 ClassDojo 歷史班級聯絡簿貼文而設計。本專案由 **Supabase (PostgreSQL)** 提供伺服器級即時資料庫支援，利用 **Cloudflare R2** 永久鏡像備份媒體照片，並結合 **Gemini 2.5-flash AI** 進行聯絡簿智慧摘要與待辦清單歸納。

- 🌐 **線上正式站點**：[https://jim-dojo.jojociao.me/](https://jim-dojo.jojociao.me/) (Cloudflare Pages)
- 📋 **Jira 專案 Epic**：[POV-32](https://ciaosi.atlassian.net/browse/POV-32)
- 📄 **Confluence 產品需求文檔 (PRD)**：[ClassDojo Archive 現代化雲端原生重構 PRD v2.0](https://ciaosi.atlassian.net/wiki/spaces/POV/pages/3932187/ClassDojo+Archive+PRD+v2.0)

---

## 🌟 特色功能

1. **Supabase 雲端資料庫直連**
   - 前端直連 Supabase PostgreSQL 資料表 `dojo_posts`，以分頁機制流暢讀取 1,323+ 筆全量貼文。
   - 即時連線狀態指示燈，支援一鍵手動重新整理。

2. **Cloudflare R2 媒體永久鏡像**
   - 解決 ClassDojo 原始圖片與附件帶有 AWS CloudFront 暫時性簽章過期破圖問題。
   - 附件實體鏡像儲存至 Cloudflare R2，支援原圖預覽與另開檢視。

3. **Gemini 2.5-flash 智慧摘要與問答**
   - 串接 **Gemini 2.5-flash** 引擎，一鍵分析當前篩選的貼文。
   - 自動歸納為兩大區塊：**「智慧重要總結 / 注意事項」** 與 **「聯絡簿待辦清單」**。
   - 待辦清單保留手動勾選完成狀態，並持久化保存於 LocalStorage。
   - 支援互動式對話助手，隨時詢問班級歷史事項。

4. **靈活的多重篩選面板**
   - **日曆時間檢視**：按月檢視發文日期並進行精準過濾。
   - **發文教師篩選**：直覺切換教師類別，動態統計各教師貼文數。
   - **年級分類篩選**：自動計算台灣學年度與學期分類。
   - **全文快速檢索**：即時搜尋貼文內文與標籤。

---

## 🛠️ 本地開發與建置

### 1. 安裝依賴
```bash
npm install
```

### 2. 環境變數配置
複製 `.env.example` 並建立 `.env`：
```bash
cp .env.example .env
```
填寫必要變數：
- `VITE_SUPABASE_URL`: Supabase 專案網址
- `VITE_SUPABASE_ANON_KEY`: Supabase 公開匿名金鑰
- `VITE_GEMINI_API_KEY`: Gemini API 金鑰
- `R2_*`: Cloudflare R2 物件儲存金鑰（採集腳本使用）

### 3. 啟動本機開發伺服器
```bash
npm run dev
```

### 4. 生產環境打包
```bash
npm run build
```
產物生成於 `dist/`，已配置 `.cfignore` 防止非必要後端腳本上傳。
