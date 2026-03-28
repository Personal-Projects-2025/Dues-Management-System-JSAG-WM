/**
 * One-off: set all members' join date (Supabase + Mongo tenant DBs).
 * JOIN_DATE_MAINTENANCE_VALUE in .env (default 2026-01-01).
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const { runJoinDateMaintenance } = await import('../jobs/joinDateMaintenance.js');

runJoinDateMaintenance()
  .then((s) => {
    console.log(JSON.stringify(s, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
