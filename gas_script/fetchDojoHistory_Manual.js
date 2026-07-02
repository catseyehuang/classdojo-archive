function fetchClassDojoHistoryManual() {
  // 從專案屬性讀取 Root 資料夾 ID 與 Cookie 
  const scriptProperties = PropertiesService.getScriptProperties();
  const ROOT_FOLDER_ID = scriptProperties.getProperty('ROOT_FOLDER_ID') || '';
  const myCookie = scriptProperties.getProperty('CL_COOKIE') || '';

  if (!ROOT_FOLDER_ID || !myCookie) {
    Logger.log('錯誤：請在 GAS 專案設定中設定 Script Properties：ROOT_FOLDER_ID, CL_COOKIE');
    return;
  }

  // 1. Request URL (網址預設值，若有變動可在此直接修改)
  var apiUrl = "https://home.classdojo.com/api/storyFeed?withStudentCommentsAndLikes=true&withSyntheticPosts=true";

  // 設定請求標頭，偽裝成一般瀏覽器
  var options = {
    "method": "get",
    "headers": {
      "Cookie": myCookie,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json"
    },
    "muteHttpExceptions": true
  };

  var responseCode = null;

  try {
    const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    
    // 動態尋找或自動建立 JSON_RAW 子資料夾
    let folder;
    const subFolders = rootFolder.getFoldersByName('JSON_RAW');
    if (subFolders.hasNext()) {
      folder = subFolders.next();
    } else {
      folder = rootFolder.createFolder('JSON_RAW');
      Logger.log('已自動在 Root 建立 JSON_RAW 子資料夾');
    }

    // 發送請求
    var response = UrlFetchApp.fetch(apiUrl, options);
    responseCode = response.getResponseCode();

    if (responseCode === 200) {
      var jsonString = response.getContentText();
      
      // 解析並重新格式化 JSON，讓它有縮排、更易讀
      var jsonData = JSON.parse(jsonString);
      var items = jsonData._items || [];

      if (items.length === 0) {
        Logger.log("⚠️ ClassDojo 回傳的貼文清單為空。");
        return;
      }

      // --- 核心邏輯：決定檔名時間戳記 進入 _items 陣列抓取第一筆貼文時間---
      var rawTimestamp = items[0].time;
      var dateObj = new Date(rawTimestamp);
      var timeStr = Utilities.formatDate(dateObj, "GMT+8", "yyyyMMdd_HHmmss");
      var formattedFileName = "ClassDojo_Feed_" + timeStr + ".json";

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

    } else {
      Logger.log("❌ 發生錯誤，HTTP 狀態碼：" + responseCode);
      Logger.log("錯誤訊息：" + response.getContentText());
    }
  } catch (e) {
    if (responseCode !== null) {
      Logger.log("HTTP 狀態碼：" + responseCode);
    }
    Logger.log("腳本執行失敗：" + e.toString());
  }
}
