import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { uploadToR2 } from './r2Client.mjs';
import { verifySessionValid, loginAndSaveSession } from './classDojoAuth.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const STORAGE_STATE_PATH = path.resolve(__dirname, 'session/storageState.json');
const MIGRATION_STATE_PATH = path.resolve(__dirname, 'session/migrationState.json');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ 請先在 .env 設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * 讀取或初始化遷移游標狀態
 */
function loadMigrationState(reset = false) {
  if (reset || !fs.existsSync(MIGRATION_STATE_PATH)) {
    return {
      currentApiUrl: 'https://home.classdojo.com/api/storyFeed?withStudentCommentsAndLikes=true&withSyntheticPosts=true',
      pageCount: 1,
      totalMigratedPosts: 0,
      totalMigratedMedia: 0,
      lastRunTime: null
    };
  }

  try {
    const raw = fs.readFileSync(MIGRATION_STATE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('⚠️ 讀取 migrationState.json 失敗，重設為預設起點');
    return {
      currentApiUrl: 'https://home.classdojo.com/api/storyFeed?withStudentCommentsAndLikes=true&withSyntheticPosts=true',
      pageCount: 1,
      totalMigratedPosts: 0,
      totalMigratedMedia: 0,
      lastRunTime: null
    };
  }
}

/**
 * 保存遷移游標狀態
 */
function saveMigrationState(state) {
  const dir = path.dirname(MIGRATION_STATE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  state.lastRunTime = new Date().toISOString();
  fs.writeFileSync(MIGRATION_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * 下載媒體資源並轉為 Buffer
 */
async function fetchMediaBuffer(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://home.classdojo.com/'
    }
  });

  if (!res.ok) {
    throw new Error(`下載媒體失敗 (HTTP ${res.status}): ${url}`);
  }

  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await res.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: contentType
  };
}

/**
 * 查詢目前資料庫剩餘待修補貼文數
 */
async function getRemainingUnmigratedCount() {
  const { data, error } = await supabase
    .from('dojo_posts')
    .select('post_id')
    .not('attachments', 'is', null);

  if (error) {
    console.warn('⚠️ 查詢剩餘未遷移貼文失敗:', error.message);
    return '未知';
  }

  // 篩選出附件未包含 r2.dev 且長度大於 0 的貼文
  const { count } = await supabase
    .from('dojo_posts')
    .select('*', { count: 'exact', head: true })
    .not('attachments', 'is', null)
    .not('attachments::text', 'like', '%r2.dev%');

  return count ?? '未知';
}

/**
 * 批次歷史媒體修補主函式
 * @param {Object} options
 * @param {number} options.targetPosts 本次批次目標處理貼文數 (預設 100)
 * @param {boolean} options.reset 是否重設游標自最新開始
 * @param {boolean} options.dryRun 試跑模式
 */
export async function runBatchMediaMigration(options = {}) {
  const targetPosts = options.targetPosts || 100;
  const reset = options.reset || false;
  const dryRun = options.dryRun || false;

  console.log(`\n================================================================`);
  console.log(`🚀 啟動 ClassDojo 歷史附件批次修補管線 (POV-38)`);
  console.log(`🎯 本次批次目標：修補 ${targetPosts} 筆貼文之附件`);
  console.log(`⚙️ 模式：${dryRun ? '🔍 乾跑 (Dry Run - 不寫入)' : '⚡ 正式修補轉存 R2'}`);
  console.log(`================================================================\n`);

  // 1. 檢驗 Session
  const isSessionValid = await verifySessionValid();
  if (!isSessionValid) {
    console.log('🔑 Session 不存在或已過期，啟動互動登入流程...');
    await loginAndSaveSession();
  }

  const state = loadMigrationState(reset);
  console.log(`📍 當前游標起點：第 ${state.pageCount} 頁 (${state.currentApiUrl.substring(0, 75)}...)`);
  console.log(`📊 歷史累計已修補：${state.totalMigratedPosts} 筆貼文、${state.totalMigratedMedia} 個媒體檔案\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
  const apiRequest = context.request;

  let currentUrl = state.currentApiUrl;
  let batchPostsCount = 0;
  let batchMediaCount = 0;
  let skippedPostsCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  try {
    while (currentUrl && batchPostsCount < targetPosts) {
      console.log(`\n📄 [第 ${state.pageCount} 頁] 正在向 ClassDojo 請求歷史動態...`);
      const response = await apiRequest.get(currentUrl);

      if (response.status() !== 200) {
        console.error(`❌ ClassDojo API 請求失敗 (HTTP ${response.status()})`);
        break;
      }

      const jsonData = await response.json();
      const rawPosts = jsonData._items || jsonData;

      if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
        console.log('ℹ️ 此分頁無貼文，已抵達最末端。');
        break;
      }

      console.log(`  取得 ${rawPosts.length} 筆貼文，開始比對 Supabase 資料庫...`);

      for (const item of rawPosts) {
        if (batchPostsCount >= targetPosts) {
          console.log(`\n🎉 已達成本次批次目標 (${targetPosts} 筆)，暫停本輪作業！`);
          break;
        }

        const postId = item.id || item._id;
        if (!postId) continue;

        const rawAttachments = item.contents?.attachments || item.attachments || [];
        if (rawAttachments.length === 0) {
          skippedPostsCount++;
          continue;
        }

        // 查詢 Supabase 既有貼文
        const { data: dbPost, error: queryErr } = await supabase
          .from('dojo_posts')
          .select('post_id, author, created_at_taiwan, attachments')
          .eq('post_id', postId)
          .maybeSingle();

        if (queryErr || !dbPost) {
          skippedPostsCount++;
          continue;
        }

        // 檢查是否已有所有附件均為 R2
        const existingAttachments = Array.isArray(dbPost.attachments) ? dbPost.attachments : [];
        const isAlreadyFullyMirrored = existingAttachments.length > 0 && 
          existingAttachments.every(att => att.url && (att.url.includes('r2.dev') || att.url.includes('pub-')));

        if (isAlreadyFullyMirrored) {
          skippedPostsCount++;
          continue;
        }

        // 本篇貼文含有未鏡像之附件，開始修補！
        const postDate = dbPost.created_at_taiwan ? dbPost.created_at_taiwan.substring(0, 10) : '未知日期';
        console.log(`\n  📸 [貼文 ${batchPostsCount + 1}/${targetPosts}] 修補 ID: ${postId} (${postDate} by ${dbPost.author || '未知'})，含 ${rawAttachments.length} 個附件`);

        let newAttachments = [];
        let postMediaUploaded = 0;

        for (let i = 0; i < rawAttachments.length; i++) {
          const att = rawAttachments[i];
          const rawUrl = att.url || att.path || '';
          const type = att.type || 'photo';
          const filename = att.filename || `attachment_${i + 1}`;

          // 若該附件先前已經上傳過 R2，保留既有 R2 網址
          if (existingAttachments[i]?.url && (existingAttachments[i].url.includes('r2.dev') || existingAttachments[i].url.includes('pub-'))) {
            newAttachments.push(existingAttachments[i]);
            continue;
          }

          if (dryRun) {
            console.log(`    [Dry-run] 將鏡像: [${type}] ${filename} -> R2`);
            newAttachments.push({ type, filename, url: 'r2://mock-url', original_url: rawUrl });
            postMediaUploaded++;
            continue;
          }

          // 下載並上傳至 R2
          if (rawUrl.startsWith('http')) {
            try {
              const { buffer, mimeType } = await fetchMediaBuffer(rawUrl);
              const ext = path.extname(filename) || (mimeType.includes('jpeg') ? '.jpg' : mimeType.includes('png') ? '.png' : '');
              const cleanKey = `media/${postId}_${i}${ext}`;
              const r2Url = await uploadToR2(buffer, cleanKey, mimeType);

              newAttachments.push({
                type,
                filename,
                url: r2Url,
                original_url: rawUrl
              });
              postMediaUploaded++;
              batchMediaCount++;
              console.log(`    ✅ R2 上傳成功: ${r2Url}`);
            } catch (upErr) {
              console.warn(`    ⚠️ 附件上傳失敗，保留原網址: ${upErr.message}`);
              newAttachments.push({ type, filename, url: rawUrl });
              errorCount++;
            }
          } else {
            newAttachments.push({ type, filename, url: rawUrl });
          }
        }

        // 更新回 Supabase
        if (!dryRun && postMediaUploaded > 0) {
          const { error: updateErr } = await supabase
            .from('dojo_posts')
            .update({
              attachments: newAttachments,
              updated_at_db: new Date().toISOString()
            })
            .eq('post_id', postId);

          if (updateErr) {
            console.error(`    ❌ 更新 Supabase 失敗:`, updateErr.message);
            errorCount++;
          } else {
            batchPostsCount++;
            state.totalMigratedPosts++;
            state.totalMigratedMedia += postMediaUploaded;
            console.log(`    💾 已成功更新 Supabase 貼文附件 (${newAttachments.length} 個附件)`);
          }
        } else if (dryRun) {
          batchPostsCount++;
        }
      }

      // 若尚未達到目標，檢查是否有下一頁 (歷史更早的分頁)
      if (batchPostsCount < targetPosts) {
        if (jsonData._links?.prev?.href) {
          currentUrl = jsonData._links.prev.href;
          state.currentApiUrl = currentUrl;
          state.pageCount++;
          saveMigrationState(state);
          console.log(`  ⏳ 禮貌性冷卻 1.5 秒後進入下一頁...`);
          await new Promise(r => setTimeout(r, 1500));
        } else {
          console.log('\n🎉 已無更早的分頁，已遍歷至 ClassDojo 歷史貼文最前端！');
          break;
        }
      }
    }

    // 保存當前最新游標狀態
    saveMigrationState(state);

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n================================================================`);
    console.log(`🏁 本批次修補執行完成！`);
    console.log(`⏱️ 耗時：${elapsedSeconds} 秒`);
    console.log(`✅ 本批次成功修補貼文：${batchPostsCount} 筆`);
    console.log(`🖼️ 本批次轉存 R2 媒體數：${batchMediaCount} 個`);
    console.log(`⏩ 跳過無需修補/無附件：${skippedPostsCount} 筆`);
    if (errorCount > 0) {
      console.log(`⚠️ 發生異常數：${errorCount} 筆`);
    }
    console.log(`📈 全專案累計修補貼文：${state.totalMigratedPosts} 筆 (媒體共 ${state.totalMigratedMedia} 個)`);
    console.log(`================================================================\n`);

  } catch (err) {
    console.error('❌ 執行批次修補管線失敗:', err);
  } finally {
    await browser.close();
  }
}

// 支援命令列直接執行
const args = process.argv.slice(2);
const batchArg = args.find(a => a.startsWith('--batch=') || a.startsWith('--target='));
const targetPosts = batchArg ? parseInt(batchArg.split('=')[1], 10) : 100;
const reset = args.includes('--reset');
const dryRun = args.includes('--dry-run');

if (process.argv[1] && process.argv[1].endsWith('batchMigrateAttachments.mjs')) {
  runBatchMediaMigration({ targetPosts, reset, dryRun });
}
