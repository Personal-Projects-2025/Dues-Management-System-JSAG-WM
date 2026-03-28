/**
 * Set every member's join date to a fixed date (Mongo + Supabase).
 * Used by cron and by CLI scripts.
 */
import { createClient } from '@supabase/supabase-js';
import { connectMasterDB } from '../config/db.js';
import { getTenantConnection } from '../utils/connectionManager.js';

const DEFAULT_JOIN_DATE = process.env.JOIN_DATE_MAINTENANCE_VALUE || '2026-01-01';

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function runJoinDateMaintenance() {
  const target = new Date(`${DEFAULT_JOIN_DATE}T12:00:00.000Z`);
  const summary = { supabase: null, mongo: null };

  const sb = getSupabaseClient();
  if (sb) {
    const { error } = await sb
      .from('members')
      .update({ join_date: DEFAULT_JOIN_DATE })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      summary.supabase = { ok: false, error: error.message };
    } else {
      summary.supabase = { ok: true, join_date: DEFAULT_JOIN_DATE };
    }
  } else {
    summary.supabase = { ok: false, skipped: true, reason: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing' };
  }

  try {
    const masterConn = await connectMasterDB();
    const masterDb = masterConn.db;
    const tenants = await masterDb.collection('tenants').find({ deletedAt: null }).toArray();
    let mongoMembers = 0;
    for (const tenant of tenants) {
      const dbName = tenant.databaseName;
      if (!dbName) continue;
      try {
        const conn = await getTenantConnection(dbName);
        const result = await conn.db.collection('members').updateMany({}, { $set: { joinDate: target } });
        mongoMembers += result.modifiedCount ?? result.nModified ?? 0;
      } catch (e) {
        console.warn(`[joinDateMaintenance] Mongo tenant ${tenant.name}: ${e.message}`);
      }
    }
    summary.mongo = { ok: true, tenants: tenants.length, modifiedApprox: mongoMembers };
  } catch (e) {
    summary.mongo = { ok: false, error: e.message };
  }

  return summary;
}
