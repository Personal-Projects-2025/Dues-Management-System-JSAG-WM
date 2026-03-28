import cron from 'node-cron';
import { runMongoToSupabaseMirror } from './mongoSupabaseMirrorJob.js';
import { runJoinDateMaintenance } from './joinDateMaintenance.js';

/**
 * Optional crons (opt-in via env):
 * - ENABLE_MONGO_SUPABASE_MIRROR_CRON=true — copy Mongo → Supabase on MIRROR_CRON_SCHEDULE (default 02:00 daily)
 * - ENABLE_JOIN_DATE_MAINTENANCE_CRON=true — set all members' join date on JOIN_DATE_CRON_SCHEDULE (default 03:00 daily)
 *
 * Schedule join-date cron after mirror so Supabase reflects Mongo, then both are normalized if you use the join-date job.
 */
export function initMirrorAndJoinDateCrons() {
  if (process.env.ENABLE_MONGO_SUPABASE_MIRROR_CRON === 'true') {
    const expr = process.env.MIRROR_CRON_SCHEDULE || '0 2 * * *';
    cron.schedule(expr, async () => {
      try {
        console.log('[cron] Mongo → Supabase mirror started');
        const r = await runMongoToSupabaseMirror();
        console.log('[cron] Mongo → Supabase mirror done:', r);
      } catch (e) {
        console.error('[cron] Mongo → Supabase mirror failed:', e.message || e);
      }
    });
    console.log(`📅 Mongo→Supabase mirror cron: ${expr} (ENABLE_MONGO_SUPABASE_MIRROR_CRON=true)`);
  }

  if (process.env.ENABLE_JOIN_DATE_MAINTENANCE_CRON === 'true') {
    const expr = process.env.JOIN_DATE_CRON_SCHEDULE || '0 3 * * *';
    cron.schedule(expr, async () => {
      try {
        console.log('[cron] Join date maintenance started');
        const s = await runJoinDateMaintenance();
        console.log('[cron] Join date maintenance done:', JSON.stringify(s));
      } catch (e) {
        console.error('[cron] Join date maintenance failed:', e.message || e);
      }
    });
    console.log(`📅 Join date maintenance cron: ${expr} (ENABLE_JOIN_DATE_MAINTENANCE_CRON=true)`);
  }
}
