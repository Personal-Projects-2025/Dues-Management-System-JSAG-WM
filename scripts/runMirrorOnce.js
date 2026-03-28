/**
 * Manual run: mirror MongoDB → Supabase (same logic as nightly cron).
 * Requires MONGODB_URI / MASTER_DB_URI + SUPABASE_* in backend/.env
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const { runMongoToSupabaseMirror } = await import('../jobs/mongoSupabaseMirrorJob.js');

runMongoToSupabaseMirror()
  .then((r) => {
    console.log('Mirror finished:', r);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Mirror failed:', err);
    process.exit(1);
  });
