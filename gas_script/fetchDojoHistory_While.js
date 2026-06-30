function fetchAllClassDojoHistoryWithTimeFilename() {
  // 1. 起始 URL
  var apiUrl = "https://home.classdojo.com/api/storyFeed?withStudentCommentsAndLikes=true&withSyntheticPosts=true";
  
  // 2. 貼上你的 Cookie
  var myCookie = "myCookie"
  
  // 3. 你的 Google Drive 資料夾 ID
  var folderId = "Google Drive 資料夾 ID";

  var options = {
    "method": "get",
    "headers": {
      "Cookie": myCookie,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json"
    },
    "muteHttpExceptions": true
  };

  var folder = DriveApp.getFolderById(folderId);
  var pageCount = 1;
  var maxPages = 200;

  while (apiUrl && pageCount <= maxPages) {
    Logger.log("------------------------------------------");
    Logger.log("正在抓取第 " + pageCount + " 頁...");
    
    try {
      var response = UrlFetchApp.fetch(apiUrl, options);
      if (response.getResponseCode() !== 200) {
        Logger.log("❌ 發生錯誤，HTTP代碼：" + response.getResponseCode());
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
