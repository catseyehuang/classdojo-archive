# ClassDojo 歷史紀錄存檔檢視器 (ClassDojo Archive Viewer)

這是一個基於 **React + Vite** 建立的高級單頁應用程式（SPA），專為瀏覽、檢索與分析 ClassDojo 歷史班級聯絡簿貼文而設計。本工具整合了 Google Drive 雲端同步，並結合 Gemini 2.5-flash AI 進行聯絡簿重點歸納。

---

## 🌟 特色功能

1. **Google Drive 雲端同步**
   - 支援填入雲端資料夾 ID 及 Google Drive API 金鑰，線上搜尋並讀取 `dojo_data.json` 存檔。
   - 支援 **Shared Drives (共用雲端硬碟)** 容錯讀取。
   - 未連線時標示為「**本地資料**」，同步成功後顯示綠色呼吸燈，且連線按鈕會自動切換為圓形 **「重新更新」小圖標**，方便快速重整資料。

2. **Gemini 2.5-flash 智慧摘要**
   - 串接 **Gemini 2.5-flash** 引擎，一鍵分析當前篩選的貼文。
   - 自動歸納為兩大區塊：**「智慧重要總結 / 注意事項」** 與 **「聯絡簿待辦清單」**。
   - 待辦清單保留手動勾選完成狀態，並持久化保存於 LocalStorage。
   - 當貼文篩選條件改變時，自動切回本地比對，確保資訊即時性。

3. **靈活的多重篩選面板**
   - **日曆時間檢視**：按月檢視發文日期並進行精準過濾。
   - **發文教師篩選**：直覺切換教師類別，並動態顯示符合貼文之數量。
   - **年級分類篩選**：改進的下拉選單分類，選中後呈現質感淺藍色背景。
   - **全文快速檢索**：頂部搜尋列可即時搜尋貼文內容與翻譯文字。

4. **靜態附件呈現**
   - 考量到 ClassDojo 原始圖片與附件網址有 AWS CloudFront 時效簽章（Signature）過期問題，所有附件（照片、影片、外部連結、檔案）均統一以**不可點擊的文字標籤搭配小圖示**呈現，畫面乾淨且避免載入破圖。

---

## 🛠️ 開發與建置環境

本專案使用 `npm` 作為套件管理工具。

### 1. 安裝依賴
```bash
npm install
```

### 2. 啟動開發伺服器 (Local Development)
```bash
npm run dev
```
啟動後在瀏覽器開啟 [http://localhost:5173/](http://localhost:5173/)。

### 3. 專案打包建置 (Production Build)
```bash
npm run build
```
建置後的靜態資源將生成於 `dist/` 資料夾。

---

## ⚙️ 工具設定指引 (Settings Guide)

點擊主頁右上角的齒輪圖標，會滑出「工具設定」抽屜，您可以在此設定您的專案憑證（資料僅安全儲存於您的個人瀏覽器 LocalStorage 中）：

1. **Google Drive API Key**
   - 用於存取 Google Drive API 以讀取 `dojo_data.json` 檔案。
   
2. **Gemini API Key**
   - 請至 [Google AI Studio](https://aistudio.google.com/) 申請一組專屬 Gemini 用的 API Key，填入此處以啟用 `gemini-2.5-flash` 智慧總結功能。
   
3. **Google Drive Folder ID**
   - 存放 `dojo_data.json` 的雲端硬碟資料夾 ID。請確保該資料夾與檔案在雲端已設定為「**知道連結的任何人皆可檢視**」。

### 💡 如何在 Google Cloud 啟用 Google Drive API 權限？
如果您在使用 Google Drive API Key 時遇到 API 不支援的錯誤：
1. 進入 [Google Cloud Console](https://console.cloud.google.com/)。
2. 選擇您的專案，前往「**API 和服務**」 > 「**程式庫 (API Library)**」。
3. 搜尋並啟用 **`Google Drive API`**。
4. 搜尋並啟用 **`Generative Language API`**（此即 Gemini API 於 Cloud Console 的官方名稱），即可在該金鑰的限制選單中同時勾選這兩者，達成金鑰共用。
