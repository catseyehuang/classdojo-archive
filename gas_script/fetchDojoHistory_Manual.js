// 3. 貼上你的 Google Drive 資料夾 ID
  var folderId = "Google Drive 資料夾 ID";

function fetchClassDojoHistoryManual() {
  // 1. 貼上你從 F12 複製下來的 Request URL
  //在右側的 Headers -> General 找到 Request URL，把它複製下來（這就是 apiUrl）。
  
  var apiUrl = "https://home.classdojo.com/api/storyFeed?withStudentCommentsAndLikes=true&withSyntheticPosts=true";
  
  // 2. 貼上你從 F12 複製下來的 Cookie (整串字串)
  //往下捲到 Request Headers 找到 cookie:，把後面那一整串很長的字串複製下來（這就是 myCookie）。
  var myCookie = "myCookie"
  

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

  // 確保 folder 變數被正確定義
  var folder = DriveApp.getFolderById(folderId);

  try {
    // 發送請求
    var response = UrlFetchApp.fetch(apiUrl, options);
    var responseCode = response.getResponseCode();

    if (responseCode === 200) {
      var jsonString = response.getContentText();
      
      // 解析並重新格式化 JSON，讓它有縮排、更易讀
      var jsonData = JSON.parse(jsonString);
      var prettyJson = JSON.stringify(jsonData, null, 2);

      var items = jsonData._items || [];

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
    Logger.log("HTTP 狀態碼：" + responseCode);
    Logger.log("腳本執行失敗：" + e.toString());
  }
}
