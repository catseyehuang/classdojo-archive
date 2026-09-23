import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_DOMAIN
} = process.env;

/**
 * 建立 S3 客戶端 (連線至 Cloudflare R2)
 */
export function getR2Client() {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('未設定 Cloudflare R2 環境變數 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY
    }
  });
}

/**
 * 上傳檔案 Buffer 至 R2 Bucket
 * @param {Buffer|Uint8Array} buffer 檔案內容
 * @param {string} key 儲存路徑鍵值 (例如: 2026/06/post_123_photo_0.jpg)
 * @param {string} mimeType 檔案格式 (例如: image/jpeg)
 * @returns {Promise<string>} 回傳公開訪問網址
 */
export async function uploadToR2(buffer, key, mimeType = 'application/octet-stream') {
  const client = getR2Client();
  const bucket = R2_BUCKET_NAME;

  if (!bucket) {
    throw new Error('未設定 R2_BUCKET_NAME 環境變數');
  }

  const cleanKey = key.replace(/^\/+/, '');

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: cleanKey,
      Body: buffer,
      ContentType: mimeType
    })
  );

  const baseDomain = (R2_PUBLIC_DOMAIN || '').replace(/\/+$/, '');
  if (baseDomain) {
    return `${baseDomain}/${cleanKey}`;
  }

  return `https://${bucket}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${cleanKey}`;
}

/**
 * 測試 R2 連線與 Bucket 可存取性
 */
export async function testR2Connection() {
  console.log('🔍 正在檢驗 Cloudflare R2 連線...');
  console.log(`- Account ID: ${R2_ACCOUNT_ID ? '已設定 (' + R2_ACCOUNT_ID.slice(0, 6) + '...)' : '❌ 未設定'}`);
  console.log(`- Bucket Name: ${R2_BUCKET_NAME || '❌ 未設定'}`);
  console.log(`- Public Domain: ${R2_PUBLIC_DOMAIN || '⚠️ 未設定 (將使用預設 endpoint)'}`);

  try {
    const client = getR2Client();
    await client.send(new HeadBucketCommand({ Bucket: R2_BUCKET_NAME }));
    console.log('✅ 成功連線至 Cloudflare R2 且 Bucket 存取權限正常！');

    // 進行微小檔案寫入測試
    const testKey = `_test/connection_check_${Date.now()}.txt`;
    const testUrl = await uploadToR2(Buffer.from('R2 Connection OK'), testKey, 'text/plain');
    console.log(`✅ 寫入測試成功！檔案 URL: ${testUrl}`);
    return true;
  } catch (err) {
    console.error('❌ Cloudflare R2 連線失敗:', err.message);
    return false;
  }
}

// 支援直接執行測試: node scripts/r2Client.mjs
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  testR2Connection();
}
