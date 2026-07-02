function fetchAllClassDojoHistoryWithTimeFilename() {
  // 從專案屬性讀取 Root 資料夾 ID 與 Cookie 
  const scriptProperties = PropertiesService.getScriptProperties();
  const ROOT_FOLDER_ID = scriptProperties.getProperty('ROOT_FOLDER_ID') || '';
  const myCookie = scriptProperties.getProperty('CL_COOKIE') || '';

  if (!ROOT_FOLDER_ID || !myCookie) {
    Logger.log('錯誤：請在 GAS 專案設定中設定 Script Properties：ROOT_FOLDER_ID, CL_COOKIE');
    return;
  }

  // 1. 起始 URL
  var apiUrl = "https://home.classdojo.com/api/storyFeed?withStudentCommentsAndLikes=true&withSyntheticPosts=true";

  var options = {
    "method": "get",
    "headers": {
      "Cookie": myCookie,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json"
    },
    "muteHttpExceptions": true
  };

  let folder;
  try {
    const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    
    // 動態尋找或自動建立 JSON_RAW 子資料夾
    const subFolders = rootFolder.getFoldersByName('JSON_RAW');
    if (subFolders.hasNext()) {
      folder = subFolders.next();
    } else {
      folder = rootFolder.createFolder('JSON_RAW');
      Logger.log('已自動在 Root 建立 JSON_RAW 子資料夾');
    }
  } catch (e) {
    Logger.log("❌ 無法取得 Google Drive 資料夾，請檢查 ROOT_FOLDER_ID 是否正確: " + e.toString());
    return;
  }

  var pageCount = 1;
  var maxPages = 200;

  while (apiUrl && pageCount <= maxPages) {
    Logger.log("------------------------------------------");
    Logger.log("正在抓取第 " + pageCount + " 頁...");
    
    try {
      var response = UrlFetchApp.fetch(apiUrl, options);
      var responseCode = response.getResponseCode();
      
      if (responseCode !== 200) {
        Logger.log("❌ 發生錯誤，HTTP代碼：" + responseCode);
        if (responseCode === 401 || responseCode === 403) {
          Logger.log("⚠️ 偵測到未授權錯誤 (401/403)，可能是 Cookie 已經過期，中斷迴圈！");
        } else {
          Logger.log("錯誤內容：" + response.getContentText());
        }
        break;
      }

      var jsonString = response.getContentText();
      var jsonData = JSON.parse(jsonString);
      
      // --- 核心邏輯：決定檔名時間戳記 ---
      var rawTimestamp = "";
      
      // 邏輯 A：嘗試從目前請求的 URL 中提取 "before" 參數（第二頁開始）
      var beforeMatch = apiUrl.match(/before=([^&]+)/);
      if (beforeMatch) {
        rawTimestamp = decodeURIComponent(beforeMatch[1]);
        Logger.log("🕒 檔名來源：URL 參數 before");
      } 
      // 邏輯 B：第一頁沒有 before，精準進入 _items 陣列抓取第一筆貼文時間
      else {
        var items = jsonData._items || jsonData; // 兼容 _items 結構
        if (items && items.length > 0 && items[0].time) {
          rawTimestamp = items[0].time;
          Logger.log("🕒 檔名來源：第一筆貼文 _items[0].time 欄位");
        }
      }

      // 轉換為台灣時間 (GMT+8) 並格式化檔名
      var formattedFileName = "ClassDojo_Feed_Unknown.json";
      if (rawTimestamp) {
        var dateObj = new Date(rawTimestamp);
        var timeStr = Utilities.formatDate(dateObj, "GMT+8", "yyyyMMdd_HHmmss");
        formattedFileName = "ClassDojo_Feed_" + timeStr + ".json";
      }

      // --- 💥 檔名防呆重複檢查 💥 ---
      var existingFiles = folder.getFilesByName(formattedFileName);
      if (existingFiles.hasNext()) {
        Logger.log("⏭️ 偵測到相同檔名已存在，防呆機制啟動！跳過此頁儲存：" + formattedFileName);
      } else {
        // 雲端無重複檔案，執行儲存
        var prettyJson = JSON.stringify(jsonData, null, 2);
        folder.createFile(formattedFileName, prettyJson, MimeType.PLAIN_TEXT);
        Logger.log("💾 已成功儲存新檔案：" + formattedFileName);
      }

      // 設定下一頁
      if (jsonData._links && jsonData._links.prev && jsonData._links.prev.href) {
        apiUrl = jsonData._links.prev.href;
      } else {
        Logger.log("🎉 全部歷史資料抓取完畢！");
        break;
      }

      pageCount++;
      Utilities.sleep(2000); // 防封鎖間隔

    } catch (e) {
      Logger.log("❌ 執行失敗：" + e.toString());
      break;
    }
  }
}
