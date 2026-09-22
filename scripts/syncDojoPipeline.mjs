import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { uploadToR2, getR2Client } from './r2Client.mjs';
import { STORAGE_STATE_PATH, verifySessionValid, loginAndSaveSession } from './classDojoAuth.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const {
  VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY,
  R2_ACCOUNT_ID,
  R2_BUCKET_NAME
} = process.env;

if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
  console.error('❌ 缺少 Supabase 連線憑證 (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

/**
 * 將原始 UTC ISO 時間轉換為台灣時間字串 (YYYY-MM-DDTHH:mm:ss)
 */
function convertToTaiwanTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const taiwanOffset = 8 * 60;
  const localOffset = date.getTimezoneOffset();
  const taiwanTime = new Date(date.getTime() + (taiwanOffset + localOffset) * 60 * 1000);

  const yyyy = taiwanTime.getFullYear();
  const mm = String(taiwanTime.getMonth() + 1).padStart(2, '0');
  const dd = String(taiwanTime.getDate()).padStart(2, '0');
  const hh = String(taiwanTime.getHours()).padStart(2, '0');
  const min = String(taiwanTime.getMinutes()).padStart(2, '0');
  const ss = String(taiwanTime.getSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
}

/**
 * 依據台灣時間計算學年度與年級學期
 */
function computeGradeSemester(taiwanTimeString) {
  if (!taiwanTimeString) return '';
  const date = new Date(taiwanTimeString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  let academicYear;
  let term;

  if (month >= 8 && month <= 12) {
    academicYear = year - 1911;
    term = '上學期';
  } else if (month === 1) {
    academicYear = year - 1912;
    term = '上學期';
  } else {
    academicYear = year - 1911;
    term = '下學期';
  }

  const gradeNum = academicYear - 112;
  const gradeZhMap = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' };
  const gradeZh = gradeZhMap[gradeNum] || `${gradeNum}`;
  const termCode = term === '上學期' ? '上' : '下';

  return `${academicYear}年${term}(${gradeZh}${termCode})`;
}

/**
 * 從 URL 下載媒體檔案 Buffer
 */
async function fetchMediaBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`下載媒體失敗 (HTTP ${res.status}): ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: contentType
  };
}

/**
 * 增量採集與同步主要流程
 */
export async function runSyncPipeline(options = {}) {
  const maxPages = options.maxPages || 100;
  const untilDate = options.untilDate || process.env.UNTIL_DATE || '2026-06-30';
  console.log(`🏁 啟動 ClassDojo 現代化雲端採集管線 (Phase 3.1)...`);
  console.log(`🎯 目標抓取區間：從最新貼文一直回溯至 ${untilDate} (最多 ${maxPages} 頁)`);

  // 1. 檢驗 Session
  const isSessionValid = await verifySessionValid();
  if (!isSessionValid) {
    console.log('🔑 Session 不存在或已過期，啟動瀏覽器互動登入...');
    await loginAndSaveSession();
  }

  // 2. 啟動 Playwright API 請求環境
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
  const apiRequest = context.request;

  let apiUrl = 'https://home.classdojo.com/api/storyFeed?withStudentCommentsAndLikes=true&withSyntheticPosts=true';
  let pageCount = 1;
  let totalNewPosts = 0;
  let totalUploadedMedia = 0;
  let reachedUntilDate = false;

  try {
    while (apiUrl && pageCount <= maxPages && !reachedUntilDate) {
      console.log(`\n📄 正在抓取 ClassDojo 第 ${pageCount} 頁...`);
      const response = await apiRequest.get(apiUrl);

      if (response.status() !== 200) {
        console.error(`❌ API 請求失敗 (HTTP ${response.status()})`);
        break;
      }

      const jsonData = await response.json();
      const rawPosts = jsonData._items || jsonData;

      if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
        console.log('ℹ️ 此頁無更多貼文，抓取結束。');
        break;
      }

      console.log(`🔍 本頁取得 ${rawPosts.length} 筆貼文，正在比對資料庫...`);

      for (const item of rawPosts) {
        const postId = item.id || item._id;
        if (!postId) continue;

        const createdAt = item.time || item.createdAt;
        const taiwanTime = convertToTaiwanTime(createdAt);

        // 若貼文時間已早於指定停止日期，標記結束
        if (untilDate && taiwanTime && taiwanTime < untilDate) {
          console.log(`  ⏹️ 貼文時間 (${taiwanTime}) 已早於指定截止日期 (${untilDate})，歷史已無縫銜接！`);
          reachedUntilDate = true;
          break;
        }
        const grade = computeGradeSemester(taiwanTime);
        const author = item.headerText || item.senderName || item.header?.title || item.author || '未知老師';
        const className = item.headerSubtext || item.header?.subtitle || item.className || '';
        const contentRaw = item.contents?.body || item.body || '';

        // 檢查 Supabase 是否已有此貼文
        const { data: existingPost } = await supabase
          .from('dojo_posts')
          .select('post_id, attachments')
          .eq('post_id', postId)
          .maybeSingle();

        // 處理附件 (attachments)
        let attachments = [];
        const rawAttachments = item.contents?.attachments || item.attachments || [];

        for (let i = 0; i < rawAttachments.length; i++) {
          const att = rawAttachments[i];
          const rawUrl = att.url || att.path || '';
          const type = att.type || 'photo';
          const filename = att.filename || `attachment_${i + 1}`;

          // 若已有 R2 URL 且未要求強制重鏡像，保留原 URL
          if (existingPost && Array.isArray(existingPost.attachments) && existingPost.attachments[i]?.url?.includes('r2.')) {
            attachments.push(existingPost.attachments[i]);
            continue;
          }

          // 若 R2 已配置且有有效 URL，下載並轉存至 R2
          if (R2_ACCOUNT_ID && R2_BUCKET_NAME && rawUrl.startsWith('http')) {
            try {
              console.log(`  📸 正在下載並上傳附件至 R2: [${type}] ${filename}...`);
              const { buffer, mimeType } = await fetchMediaBuffer(rawUrl);
              const ext = path.extname(filename) || (mimeType.includes('jpeg') ? '.jpg' : mimeType.includes('png') ? '.png' : '');
              const cleanKey = `media/${postId}_${i}${ext}`;
              const r2Url = await uploadToR2(buffer, cleanKey, mimeType);
              attachments.push({
                type,
                filename,
                url: r2Url,
                original_url: rawUrl
              });
              totalUploadedMedia++;
              console.log(`    ✅ R2 上傳成功: ${r2Url}`);
            } catch (mediaErr) {
              console.warn(`    ⚠️ 附件轉存 R2 失敗，保留原始 URL: ${mediaErr.message}`);
              attachments.push({ type, filename, url: rawUrl });
            }
          } else {
            attachments.push({ type, filename, url: rawUrl });
          }
        }

        // Upsert 存入 Supabase
        const postRecord = {
          post_id: postId,
          created_at: createdAt,
          created_at_taiwan: taiwanTime,
          author,
          class_name: className,
          grade,
          content_raw: contentRaw,
          translation: item.contents?.translation || null,
          attachments
        };

        const { error: upsertErr } = await supabase
          .from('dojo_posts')
          .upsert(postRecord, { onConflict: 'post_id' });

        if (upsertErr) {
          console.error(`  ❌ 寫入 Supabase 失敗 (post_id: ${postId}):`, upsertErr.message);
        } else {
          totalNewPosts++;
        }
      }

      // 檢查下一頁
      if (jsonData._links?.prev?.href) {
        apiUrl = jsonData._links.prev.href;
        pageCount++;
        await new Promise(r => setTimeout(r, 1500)); // 禮貌性防頻率限制間隔
      } else {
        console.log('🎉 已抵達歷史最末端！');
        break;
      }
    }

    console.log(`\n✨ 採集與同步完成！共處理/更新 ${totalNewPosts} 筆貼文，實體轉存 ${totalUploadedMedia} 個媒體檔案至 Cloudflare R2。`);
  } catch (err) {
    console.error('❌ 執行同步管線中斷:', err);
  } finally {
    await browser.close();
  }
}

// 支援命令列直接執行: node scripts/syncDojoPipeline.mjs
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const maxPages = parseInt(process.env.MAX_PAGES || '60', 10);
  const untilDate = process.env.UNTIL_DATE || '2026-06-30';
  runSyncPipeline({ maxPages, untilDate });
}
