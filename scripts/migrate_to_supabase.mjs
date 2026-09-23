import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://aasjvnwvlbucqrnipmgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhc2p2bnd2bGJ1Y3FybmlwbWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3OTg5MjcsImV4cCI6MjEwNTM3NDkyN30.ED_3MO8wHxbdi1QiLLwD-xTjnWS8z4tTf4iC6ukiD8g';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runMigration() {
  console.log('🚀 開始全量 ClassDojo 資料（含 2026-06-30 最新版本）遷移至 Supabase...');

  const rootDir = path.resolve(__dirname, '../../');
  const targetNewFile = path.join(rootDir, 'dojo_data_2026-06-30.json');
  const localFile = path.join(rootDir, 'dojo_data.json');
  const gdriveFile = path.join(rootDir, 'gdrive_dojo.json');

  const targetData = fs.existsSync(targetNewFile) ? JSON.parse(fs.readFileSync(targetNewFile, 'utf-8')) : [];
  const localData = fs.existsSync(localFile) ? JSON.parse(fs.readFileSync(localFile, 'utf-8')) : [];
  const gdriveData = fs.existsSync(gdriveFile) ? JSON.parse(fs.readFileSync(gdriveFile, 'utf-8')) : [];

  console.log(`📂 dojo_data_2026-06-30.json 筆數: ${targetData.length}`);
  console.log(`📂 本地歷史 dojo_data.json 筆數: ${localData.length}`);
  console.log(`📂 GDrive 增量 gdrive_dojo.json 筆數: ${gdriveData.length}`);

  const postMap = new Map();

  // 1. 先置入既有資料
  localData.forEach(p => {
    if (p.post_id) postMap.set(p.post_id, p);
  });
  gdriveData.forEach(p => {
    if (p.post_id) postMap.set(p.post_id, p);
  });

  // 2. 以最新的 2026-06-30.json 覆蓋/補充，確保為最新資料
  targetData.forEach(p => {
    if (p.post_id) postMap.set(p.post_id, p);
  });

  const mergedPosts = Array.from(postMap.values());
  console.log(`✨ 最終合併去重後總筆數: ${mergedPosts.length}`);

  // 格式化資料庫 Payload
  const formattedRows = mergedPosts.map(p => {
    let attachmentsJson = [];
    if (p.attachments) {
      if (typeof p.attachments === 'string') {
        try {
          attachmentsJson = JSON.parse(p.attachments);
        } catch (e) {
          attachmentsJson = [];
        }
      } else if (Array.isArray(p.attachments)) {
        attachmentsJson = p.attachments;
      }
    }

    let validCreatedAt = p.created_at;
    try {
      const d = new Date(p.created_at);
      if (!isNaN(d.getTime())) {
        validCreatedAt = d.toISOString();
      } else if (p.created_at_taiwan) {
        validCreatedAt = new Date(p.created_at_taiwan.replace(' ', 'T')).toISOString();
      }
    } catch (e) {
      validCreatedAt = new Date().toISOString();
    }

    return {
      post_id: p.post_id,
      created_at: validCreatedAt,
      created_at_taiwan: p.created_at_taiwan || '',
      author: p.author || '未知老師',
      class_name: p.class_name || '',
      grade: p.grade || '',
      content_raw: p.content_raw || '',
      translation: p.translation || '',
      attachments: attachmentsJson
    };
  });

  // 分批寫入 (每批 100 筆)
  const batchSize = 100;
  let totalInserted = 0;

  for (let i = 0; i < formattedRows.length; i += batchSize) {
    const batch = formattedRows.slice(i, i + batchSize);
    const { error } = await supabase
      .from('dojo_posts')
      .upsert(batch, { onConflict: 'post_id' });

    if (error) {
      console.error(`\n❌ 寫入批次 ${Math.floor(i / batchSize) + 1} 失敗:`, error);
      process.exit(1);
    }
    totalInserted += batch.length;
    process.stdout.write(`⏳ 已完成寫入: ${totalInserted}/${formattedRows.length} 筆\r`);
  }

  console.log(`\n🎉 全量資料成功遷移至 Supabase! 共計 ${totalInserted} 筆記錄。`);

  // 驗證查詢
  const { count, error: countErr } = await supabase
    .from('dojo_posts')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    console.error('驗證總數失敗:', countErr);
  } else {
    console.log(`✅ Supabase 線上資料庫確認總筆數: ${count}`);
  }
}

runMigration().catch(err => {
  console.error('Migration Error:', err);
  process.exit(1);
});
