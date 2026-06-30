function processClassDojoData() {
  // 1. 定義讀取來源與寫入目標的 ID
  const SOURCE_FOLDER_ID = "讀取用的原始資料夾 ID"; // 讀取用的原始資料夾
  const TARGET_FOLDER_ID = "匯出用的目標資料夾 ID"; // 匯出用的目標資料夾
  const BACKUP_FOLDER_ID = '匯出用的備份資料夾 ID'; // 匯出用的備份資料夾

  const sourceFolder = DriveApp.getFolderById(SOURCE_FOLDER_ID);
  const targetFolder = DriveApp.getFolderById(TARGET_FOLDER_ID);
  const backupFolder = DriveApp.getFolderById(BACKUP_FOLDER_ID);

  // 檢查資料夾 ID 是否為空（預防手誤刪除）
  if (!SOURCE_FOLDER_ID) {
    Logger.log('錯誤：請在腳本中設定正確的 SOURCE_FOLDER_ID');
    return;
  }

  // 2. 讀取來源資料夾中的JSON檔案
  const files = sourceFolder.getFilesByType(MimeType.PLAIN_TEXT);

  let allRawItems = [];
  let processedPosts = [];

  Logger.log('開始讀取 JSON 檔案...');

  while (files.hasNext()) {
    const file = files.next();
    //const fileName = file.getName();
    Logger.log("偵測到檔案: " + file.getName()); // 新增這行來確認是否真的抓到檔案
    try {
      const content = file.getBlob().getDataAsString();
      const data = JSON.parse(content);

      // 確保即使檔案結構不同也能安全讀取
      const items = data._items || [];
      allRawItems = allRawItems.concat(items);
      //Logger.log(`✅ 成功讀取: ${file.getName()} (共 ${items.length} 筆貼文)`);
    } catch (e) {
      Logger.log(`❌ 讀取 ${file.getName()} 時發生錯誤: ${e.message}`);
    }
  }
  Logger.log(`--- 檔案讀取完畢，共收集到 ${allRawItems.length} 筆原始貼文 ---`);

  // 3. 解析並清洗資料 (轉換成 Web App Schema)
  for (const item of allRawItems) {
    let attachments = [];
    const contents = item.contents || {};

    if (contents.attachments) {
      for (const att of contents.attachments) {
        const attInfo = {
          type: att.type,
          filename: (att.metadata && att.metadata.filename) || 'Unknown',
          url: att.path
        };
        attachments.push(attInfo);
      }
    }

    const post = {
      post_id: item._id,
      created_at: item.time, // UTC 時間字串
      author: item.senderName || item.headerText,
      class_name: item.headerSubtext,
      content_raw: contents.body || '',
      // 略過 'translation', 'likes', 'comments' 欄位
      attachments: JSON.stringify(attachments)
    };
    processedPosts.push(post);
  }

  // 4. 資料清理：去重與時間排序 (手動實現)
  // 範例：根據 post_id 去重
  const uniquePostsMap = new Map();
  for (const post of processedPosts) {
    uniquePostsMap.set(post.post_id, post);
  }
  let uniquePosts = Array.from(uniquePostsMap.values());

  // 範例：將時間字串轉換為 JavaScript Date 物件並排序 (新到舊)
  uniquePosts.forEach(post => {
    post.created_at = new Date(post.created_at);
  });
  uniquePosts.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  Logger.log(`--- 資料清洗完畢，最終獲得 ${uniquePosts.length} 筆不重複的貼文 ---`);

  // 5. 將 created_at 轉換為台灣時區並新增 grade 欄位 (手動實現)
  uniquePosts.forEach(post => {
    // 假設 post.created_at 是原始的日期字串
    const dateObj = new Date(post.created_at);
    const timeMs = dateObj.getTime(); // 取得時間戳 (毫秒數)

    // 轉換成台灣時間字串 (GMT+8) 使用 Utilities.formatDate 強制轉換為台灣時間字串 
    post.created_at_taiwan = Utilities.formatDate(dateObj, "GMT+8", "yyyy-MM-dd'T'HH:mm:ss");


    // Grade 判斷邏輯 (手動實現)
    const postDate = timeMs;
    if (postDate >= new Date('2026-02-01T00:00:00+08:00') && postDate <= new Date('2026-07-31T23:59:59+08:00')) {
      post.grade = '114年下學期(二下)';
    } else if (postDate >= new Date('2025-08-01T00:00:00+08:00') && postDate <= new Date('2026-01-31T23:59:59+08:00')) {
      post.grade = '114年上學期(二上)';
    } else if (postDate >= new Date('2025-02-01T00:00:00+08:00') && postDate <= new Date('2025-07-31T23:59:59+08:00')) {
      post.grade = '113年下學期(一下)';
    } else if (postDate >= new Date('2024-08-01T00:00:00+08:00') && postDate <= new Date('2025-01-31T23:59:59+08:00')) {
      post.grade = '113年上學期(一上)';
    } else {
      post.grade = '其他';
    }
  });


  // 7. 匯出處理後的資料到 JSON 檔案
  const outputContent = JSON.stringify(uniquePosts, null, 2); // 格式化輸出

  const baseName = 'dojo_data_test';
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
  
  const fileNameFixed = `${baseName}.json`;
  const fileNameTimestamp = `${baseName}_${timestamp}.json`;
  
  try {
    // --- 處理第一個檔案：dojo_data.json (檢查並刪除舊檔) ---
    // 檢查目標資料夾是否已存在同名檔案，若有則刪除舊檔 (避免重複)
    const existingFiles = targetFolder.getFilesByName(fileNameFixed);
    while (existingFiles.hasNext()) {
      existingFiles.next().setTrashed(true);
    }

    // 寫入目標資料夾
    targetFolder.createFile(fileNameFixed, outputContent, MimeType.PLAIN_TEXT);
    Logger.log(`✅ 已更新檔案: ${fileNameFixed}`);

    // --- 處理第二個檔案：帶有時間戳的備份檔 ---
    backupFolder.createFile(fileNameTimestamp, outputContent, MimeType.PLAIN_TEXT);
    Logger.log(`✅ 已建立備份檔案: ${fileNameTimestamp}`);
  
  } catch (e) {
    Logger.log(`❌ 匯出檔案時發生錯誤: ${e.message}`);
  }
}
