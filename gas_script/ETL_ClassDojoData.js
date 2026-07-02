function processClassDojoData() {
  // 1. 從專案屬性讀取 Root 資料夾 ID
  const scriptProperties = PropertiesService.getScriptProperties();
  const ROOT_FOLDER_ID = scriptProperties.getProperty('ROOT_FOLDER_ID') || '';

  // 檢查資料夾 ID 是否為空
  if (!ROOT_FOLDER_ID) {
    Logger.log('錯誤：請在 GAS 專案設定中設定 Script Properties：ROOT_FOLDER_ID');
    return;
  }

  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
  
  // 動態尋找子資料夾：JSON_RAW, public, Dojo_data_backup
  // A. 來源資料夾 (JSON_RAW)
  let sourceFolder;
  const rawSubFolders = rootFolder.getFoldersByName('JSON_RAW');
  if (rawSubFolders.hasNext()) {
    sourceFolder = rawSubFolders.next();
  } else {
    sourceFolder = rootFolder.createFolder('JSON_RAW');
    Logger.log('已自動在 Root 建立 JSON_RAW 資料夾');
  }

  // B. 目標輸出資料夾 (指定放在 public 子資料夾，若無則自動建立)
  let targetFolder;
  const publicSubFolders = rootFolder.getFoldersByName('public');
  if (publicSubFolders.hasNext()) {
    targetFolder = publicSubFolders.next();
    Logger.log('✅ 已定位輸出目標：public 資料夾');
  } else {
    targetFolder = rootFolder.createFolder('public');
    Logger.log('已自動在 Root 建立 public 資料夾');
  }

  // C. 備份資料夾 (優先使用 Dojo_data_backup，若無則自動建立)
  let backupFolder;
  const backupSubFolders = rootFolder.getFoldersByName('Dojo_data_backup');
  if (backupSubFolders.hasNext()) {
    backupFolder = backupSubFolders.next();
  } else {
    backupFolder = rootFolder.createFolder('Dojo_data_backup');
    Logger.log('已自動在 Root 建立 Dojo_data_backup 資料夾');
  }

  // 2. 讀取目標資料夾中現有的 dojo_data.json 做為歷史資料庫的 Base
  const baseName = 'dojo_data'; // 可改為 'dojo_data_test' 進行測試
  const fileNameFixed = `${baseName}.json`;
  
  let existingPostsMap = new Map();
  const existingFiles = targetFolder.getFilesByName(fileNameFixed);
  if (existingFiles.hasNext()) {
    const existingFile = existingFiles.next();
    try {
      const existingContent = existingFile.getBlob().getDataAsString();
      const existingPostsList = JSON.parse(existingContent);
      if (Array.isArray(existingPostsList)) {
        existingPostsList.forEach(post => {
          existingPostsMap.set(post.post_id, post);
        });
        Logger.log(`✅ 成功載入歷史 Base 資料 (${existingPostsMap.size} 筆不重複貼文)`);
      }
    } catch (e) {
      Logger.log(`⚠️ 讀取現有 ${fileNameFixed} 失敗，將以全新資料庫處理: ${e.message}`);
    }
  } else {
    Logger.log(`ℹ️ 未找到現有 ${fileNameFixed}，將以全新資料庫處理`);
  }

  // 3. 讀取來源資料夾中直接放置的全新原始 JSON 檔案
  const files = sourceFolder.getFilesByType(MimeType.PLAIN_TEXT);
  let allRawItems = [];
  let processedFiles = [];

  Logger.log('開始讀取全新 JSON 檔案...');
  while (files.hasNext()) {
    const file = files.next();
    Logger.log("偵測到檔案: " + file.getName());
    try {
      const content = file.getBlob().getDataAsString();
      const data = JSON.parse(content);
      const items = data._items || [];
      allRawItems = allRawItems.concat(items);
      processedFiles.push(file); // 記錄成功處理的檔案，稍後歸檔
    } catch (e) {
      Logger.log(`❌ 讀取 ${file.getName()} 時發生錯誤: ${e.message}`);
    }
  }
  Logger.log(`--- 檔案讀取完畢，共收集到 ${allRawItems.length} 筆全新原始貼文 ---`);

  // 4. 解析並清洗全新資料 (轉換成 Web App Schema)
  let newPostsMap = new Map();
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
      attachments: JSON.stringify(attachments)
    };
    newPostsMap.set(post.post_id, post);
  }

  // 5. 合併全新資料與歷史 Base 資料（增量去重）
  for (const [postId, post] of newPostsMap.entries()) {
    existingPostsMap.set(postId, post);
  }
  let mergedPosts = Array.from(existingPostsMap.values());

  // 6. 將 created_at 轉換為 Date 物件，進行台灣時間時區轉換、動態年級判定與時間排序
  mergedPosts.forEach(post => {
    // 確保 created_at 是 Date 物件以進行排序
    const dateObj = new Date(post.created_at);
    post.created_at = dateObj; // stringify 時會自動轉回 ISO 格式字串

    // 轉換成台灣時間字串 (GMT+8) 
    post.created_at_taiwan = Utilities.formatDate(dateObj, "GMT+8", "yyyy-MM-dd'T'HH:mm:ss");

    // 依據台灣時間提取年與月，進行學期/年級自動判定
    const year = parseInt(Utilities.formatDate(dateObj, "GMT+8", "yyyy"), 10);
    const month = parseInt(Utilities.formatDate(dateObj, "GMT+8", "M"), 10);

    // 判斷學年度 (台灣學年度 = 西元 - 1911，若是 1 月則屬於前一年的學年度，需減 1912)
    const academicYear = (month >= 8) ? (year - 1911) : (year - 1912);

    // 判斷學期與年級字串
    const semesterName = (month >= 8 || month === 1) ? "上學期" : "下學期";
    const gradeNum = academicYear - 112; // 113 學年度為一年級

    const chineseNums = ["", "一", "二", "三", "四", "五", "六"];
    const gradeChinese = chineseNums[gradeNum] || "其他";
    const suffix = (semesterName === "上學期") ? "上" : "下";

    post.grade = `${academicYear}年${semesterName}(${gradeChinese}${suffix})`;
  });

  // 依時間由新到舊排序
  mergedPosts.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  Logger.log(`--- 資料合併與清洗完畢，最終獲得 ${mergedPosts.length} 筆不重複的貼文 ---`);

  // 7. 匯出處理後的資料到 JSON 檔案
  const outputContent = JSON.stringify(mergedPosts, null, 2);
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
  const fileNameTimestamp = `${baseName}_${timestamp}.json`;

  try {
    // --- 寫入固定名稱檔案 (dojo_data.json) ---
    const existingFixedFiles = targetFolder.getFilesByName(fileNameFixed);
    while (existingFixedFiles.hasNext()) {
      existingFixedFiles.next().setTrashed(true);
    }
    targetFolder.createFile(fileNameFixed, outputContent, MimeType.PLAIN_TEXT);
    Logger.log(`✅ 已更新固定檔案: ${fileNameFixed}`);

    // --- 寫入帶有時間戳的歷史備份檔 ---
    backupFolder.createFile(fileNameTimestamp, outputContent, MimeType.PLAIN_TEXT);
    Logger.log(`✅ 已建立備份檔案: ${fileNameTimestamp}`);

    // --- 步驟 E: 自動把已處理的新原始檔案移到 Archived_Raw 子資料夾 ---
    if (processedFiles.length > 0) {
      // 確保 Archived_Raw 子資料夾存在
      let archivedFolder;
      const subFolders = sourceFolder.getFoldersByName('Archived_Raw');
      if (subFolders.hasNext()) {
        archivedFolder = subFolders.next();
      } else {
        archivedFolder = sourceFolder.createFolder('Archived_Raw');
        Logger.log('已建立 Archived_Raw 封存資料夾');
      }

      for (const file of processedFiles) {
        file.moveTo(archivedFolder);
        Logger.log(`📁 原始檔已歸檔並移至 Archived_Raw: ${file.getName()}`);
      }
    }
    
  } catch (e) {
    Logger.log(`❌ 匯出或歸檔檔案時發生錯誤: ${e.message}`);
  }
}
