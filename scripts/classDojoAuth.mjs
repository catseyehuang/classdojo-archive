import { chromium, request } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Session 儲存路徑
export const SESSION_DIR = path.resolve(__dirname, '../scripts/session');
export const STORAGE_STATE_PATH = path.join(SESSION_DIR, 'storageState.json');

/**
 * 確保 Session 目錄存在並嘗試從環境變數還原 Session
 */
export function ensureSessionDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  // 若環境變數包含 DOJO_STORAGE_STATE，自動寫入 storageState.json (供 CI/CD GitHub Actions 使用)
  if (process.env.DOJO_STORAGE_STATE) {
    try {
      let content = process.env.DOJO_STORAGE_STATE.trim();
      if (!content.startsWith('{')) {
        try {
          content = Buffer.from(content, 'base64').toString('utf-8');
        } catch {
          // not base64, keep raw string
        }
      }
      fs.writeFileSync(STORAGE_STATE_PATH, content, 'utf-8');
      console.log('🔑 已成功自環境變數 DOJO_STORAGE_STATE 還原 Session 憑證！');
    } catch (err) {
      console.warn('⚠️ 自環境變數還原 Session 失敗:', err.message);
    }
  }
}

/**
 * 檢驗既有的 Session (storageState.json) 是否仍然有效
 * @returns {Promise<boolean>}
 */
export async function verifySessionValid() {
  ensureSessionDir();

  if (!fs.existsSync(STORAGE_STATE_PATH)) {
    return false;
  }

  let requestContext;
  try {
    requestContext = await request.newContext({ storageState: STORAGE_STATE_PATH });
    const response = await requestContext.get('https://home.classdojo.com/api/storyFeed?withStudentCommentsAndLikes=true&withSyntheticPosts=true', {
      timeout: 15000
    });

    const status = response.status();
    await requestContext.dispose();

    if (status === 200) {
      console.log('✅ 現有 ClassDojo Session 依然有效！');
      return true;
    } else {
      console.log(`⚠️ Session 已失效 (HTTP ${status})，需要重新登入。`);
      return false;
    }
  } catch (err) {
    if (requestContext) await requestContext.dispose().catch(() => {});
    console.log('⚠️ 驗證 Session 過程發生錯誤:', err.message);
    return false;
  }
}

/**
 * 啟動互動式可視化瀏覽器，引導使用者完成登入並儲存 storageState.json
 */
export async function loginAndSaveSession() {
  ensureSessionDir();
  console.log('🚀 正在啟動可視化瀏覽器進行 ClassDojo 登入...');
  console.log('👉 請在彈出的瀏覽器視窗中完成登入 (支援帳密或 Google 登入)');

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome' // 若系統有安裝 Chrome 會優先使用，否則 fallback 至 chromium
  }).catch(() => chromium.launch({ headless: false }));

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  await page.goto('https://home.classdojo.com/#/login');

  console.log('⏳ 等候登入完成中... 系統將在偵測到登入成功後自動保存 Session。');

  // 等候使用者登入成功轉導至首頁或 story feed
  try {
    // 監聽是否有取得 storyFeed API 或 URL 變更為 story / feed
    await page.waitForResponse(
      response => response.url().includes('/api/storyFeed') && response.status() === 200,
      { timeout: 300000 } // 5 分鐘寬裕時間讓使用者登入
    );

    // 額外等待 2 秒確保所有 cookie 和 token 寫入
    await page.waitForTimeout(2000);

    // 保存 storageState
    await context.storageState({ path: STORAGE_STATE_PATH });
    console.log(`🎉 登入成功！Session 已持久化保存至: ${STORAGE_STATE_PATH}`);
  } catch (err) {
    console.error('❌ 等候登入逾時或發生錯誤:', err.message);
  } finally {
    await browser.close();
  }
}

// 支援命令列直接執行: node scripts/classDojoAuth.mjs
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    const isValid = await verifySessionValid();
    if (!isValid) {
      await loginAndSaveSession();
    }
  })();
}
