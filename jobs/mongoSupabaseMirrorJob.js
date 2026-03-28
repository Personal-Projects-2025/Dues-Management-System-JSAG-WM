/**
 * Nightly mirror: MongoDB (source) → Supabase (copy).
 * Upserts tenants by slug, users by username, members by (tenant_id, member_id),
 * and related rows with stable deterministic UUIDs where needed.
 */
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { v5 as uuidv5 } from 'uuid';
import { connectMasterDB } from '../config/db.js';
import { getTenantConnection } from '../utils/connectionManager.js';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const NS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // DNS namespace for v5

const mapId = (id) => (id ? id.toString() : null);

function supabaseFromEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (url.includes('.supabase.com')) {
    throw new Error('SUPABASE_URL must use .supabase.co');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function memberBizKey(m) {
  const mid = (m.memberId && String(m.memberId).trim()) ? String(m.memberId).trim() : null;
  return mid || `__mongo_${mapId(m._id)}`;
}

async function ensureTenantRow(sb, t) {
  const slug = t.slug || '';
  const { data: existing } = await sb.from('tenants').select('id').eq('slug', slug).maybeSingle();
  const id = existing?.id || uuidv5(`tenant:${mapId(t._id)}`, NS);
  const row = {
    id,
    name: t.name || '',
    slug,
    status: t.status || 'pending',
    member_id_counter: t.memberIdCounter ?? 0,
    rejection_reason: t.rejectionReason ?? null,
    approved_at: t.approvedAt ?? null,
    approved_by: null,
    config: t.config || {},
    contact: t.contact || {},
    created_by: null,
    created_at: t.createdAt || new Date(),
    updated_at: t.updatedAt || new Date(),
    deleted_at: t.deletedAt ?? null
  };
  const { error } = await sb.from('tenants').upsert(row, { onConflict: 'slug' });
  if (error) throw error;
  const { data: again } = await sb.from('tenants').select('id').eq('slug', slug).maybeSingle();
  return again?.id || id;
}

async function upsertUser(sb, u, tenantUuidByMongo) {
  const tenantUuid = u.tenantId ? tenantUuidByMongo.get(mapId(u.tenantId)) : null;
  const { data: existing } = await sb.from('users').select('id').eq('username', u.username).maybeSingle();
  const id = existing?.id || uuidv5(`user:${mapId(u._id)}`, NS);
  const row = {
    id,
    username: u.username || '',
    email: u.email || null,
    password_hash: u.passwordHash || '',
    role: u.role || 'admin',
    tenant_id: tenantUuid,
    password_reset_token: u.passwordResetToken ?? null,
    password_reset_expires: u.passwordResetExpires ?? null,
    created_at: u.createdAt || new Date(),
    last_login: u.lastLogin ?? null
  };
  const { error } = await sb.from('users').upsert(row, { onConflict: 'username' });
  if (error) throw error;
}

async function safeFind(db, name) {
  try {
    return await db.collection(name).find({}).toArray();
  } catch {
    return [];
  }
}

export async function runMongoToSupabaseMirror() {
  const sb = supabaseFromEnv();
  if (!sb) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for mirror');
  }

  const masterConn = await connectMasterDB();
  const masterDb = masterConn.db;

  const tenants = await masterDb.collection('tenants').find({}).toArray();
  const tenantUuidByMongo = new Map();

  for (const t of tenants) {
    const id = await ensureTenantRow(sb, t);
    tenantUuidByMongo.set(mapId(t._id), id);
  }

  const users = await masterDb.collection('users').find({}).toArray();
  for (const u of users) {
    await upsertUser(sb, u, tenantUuidByMongo);
  }

  for (const tenant of tenants) {
    const tenantUuid = tenantUuidByMongo.get(mapId(tenant._id));
    const dbName = tenant.databaseName;
    if (!tenantUuid || !dbName) continue;

    let conn;
    try {
      conn = await getTenantConnection(dbName);
    } catch (e) {
      console.warn(`[mirror] Skip tenant ${tenant.name}: ${e.message}`);
      continue;
    }
    const db = conn.db;

    const members = await safeFind(db, 'members');
    const memberUuidByMongo = new Map();

    for (const m of members) {
      const biz = memberBizKey(m);
      const { data: ex } = await sb.from('members').select('id').eq('tenant_id', tenantUuid).eq('member_id', biz).maybeSingle();
      const id = ex?.id || uuidv5(`member:${tenantUuid}:${biz}`, NS);
      memberUuidByMongo.set(mapId(m._id), id);

      const row = {
        id,
        tenant_id: tenantUuid,
        name: m.name || '',
        member_id: biz,
        subgroup_id: null,
        contact: m.contact || null,
        email: m.email || null,
        role: m.role || 'member',
        join_date: (m.joinDate && new Date(m.joinDate).toISOString().slice(0, 10)) || '2026-01-01',
        dues_per_month: Number(m.duesPerMonth) || 0,
        total_paid: Number(m.totalPaid) || 0,
        months_covered: Number(m.monthsCovered) || 0,
        arrears: Number(m.arrears) || 0,
        last_payment_date: m.lastPaymentDate ? new Date(m.lastPaymentDate).toISOString().slice(0, 10) : null,
        is_auto_generated_id: m.isAutoGeneratedId || false,
        created_at: m.createdAt || new Date(),
        updated_at: m.updatedAt || new Date()
      };
      const { error } = await sb.from('members').upsert(row, { onConflict: 'id' });
      if (error) {
        console.warn(`[mirror] member ${biz}:`, error.message);
      }
    }

    const subgroups = await safeFind(db, 'subgroups');
    const subgroupUuidByMongo = new Map();
    for (const s of subgroups) {
      const sid = uuidv5(`subgroup:${mapId(s._id)}`, NS);
      subgroupUuidByMongo.set(mapId(s._id), sid);
    }
    for (const s of subgroups) {
      const id = subgroupUuidByMongo.get(mapId(s._id));
      const leaderUuid = s.leaderId ? memberUuidByMongo.get(mapId(s.leaderId)) : null;
      if (!leaderUuid) continue;
      const row = {
        id,
        tenant_id: tenantUuid,
        name: s.name || '',
        leader_id: leaderUuid,
        created_by: null,
        created_at: s.createdAt || new Date(),
        updated_at: s.updatedAt || new Date()
      };
      const { error } = await sb.from('subgroups').upsert(row, { onConflict: 'id' });
      if (error) console.warn(`[mirror] subgroup ${s.name}:`, error.message);
    }

    for (const m of members) {
      if (!m.subgroupId) continue;
      const memberUuid = memberUuidByMongo.get(mapId(m._id));
      const subgroupUuid = subgroupUuidByMongo.get(mapId(m.subgroupId));
      if (!memberUuid || !subgroupUuid) continue;
      await sb.from('members').update({ subgroup_id: subgroupUuid }).eq('id', memberUuid);
    }

    for (const m of members) {
      const memberUuid = memberUuidByMongo.get(mapId(m._id));
      if (!memberUuid) continue;
      await sb.from('payment_history').delete().eq('member_id', memberUuid);
      const history = m.paymentHistory || [];
      for (const h of history) {
        const row = {
          id: randomUUID(),
          tenant_id: tenantUuid,
          member_id: memberUuid,
          amount: Number(h.amount) || 0,
          date: h.date || new Date(),
          months_covered: Number(h.monthsCovered) || 0,
          recorded_by: h.recordedBy || '',
          created_at: h.date || new Date()
        };
        const { error } = await sb.from('payment_history').insert(row);
        if (error) console.warn('[mirror] payment_history:', error.message);
      }
    }

    const contributionTypes = await safeFind(db, 'contributiontypes');
    const typeUuidByMongo = new Map();
    for (const c of contributionTypes) {
      typeUuidByMongo.set(mapId(c._id), uuidv5(`ctype:${mapId(c._id)}`, NS));
    }
    for (const c of contributionTypes) {
      const id = typeUuidByMongo.get(mapId(c._id));
      const row = {
        id,
        tenant_id: tenantUuid,
        name: c.name || '',
        description: c.description || null,
        is_system: c.isSystem || false,
        created_at: c.createdAt || new Date(),
        updated_at: c.updatedAt || new Date()
      };
      const { error } = await sb.from('contribution_types').upsert(row, { onConflict: 'id' });
      if (error) console.warn(`[mirror] ctype ${c.name}:`, error.message);
    }

    const contributions = await safeFind(db, 'contributions');
    for (const c of contributions) {
      const typeUuid = c.contributionTypeId ? typeUuidByMongo.get(mapId(c.contributionTypeId)) : null;
      const memberUuid = c.memberId ? memberUuidByMongo.get(mapId(c.memberId)) : null;
      const id = uuidv5(`contrib:${mapId(c._id)}`, NS);
      const row = {
        id,
        tenant_id: tenantUuid,
        contribution_type_id: typeUuid,
        amount: Number(c.amount) || 0,
        date: c.date || new Date(),
        recorded_by: c.recordedBy || '',
        member_id: memberUuid,
        remarks: c.remarks || '',
        receipt_id: c.receiptId || null,
        created_at: c.createdAt || new Date(),
        updated_at: c.updatedAt || new Date()
      };
      if (!typeUuid) continue;
      const { error } = await sb.from('contributions').upsert(row, { onConflict: 'id' });
      if (error) console.warn('[mirror] contribution:', error.message);
    }

    const expenditures = await safeFind(db, 'expenditures');
    for (const e of expenditures) {
      const fundedUuid = e.fundedByContributionTypeId
        ? typeUuidByMongo.get(mapId(e.fundedByContributionTypeId))
        : null;
      const expenseKey = e.expenseId || mapId(e._id);
      const { data: ex } = await sb.from('expenditures').select('id').eq('tenant_id', tenantUuid).eq('expense_id', expenseKey).maybeSingle();
      const id = ex?.id || randomUUID();
      const row = {
        id,
        tenant_id: tenantUuid,
        expense_id: expenseKey,
        title: e.title || '',
        description: e.description || null,
        amount: Number(e.amount) || 0,
        category: e.category || null,
        date: e.date || new Date(),
        spent_by: e.spentBy || '',
        funded_by_contribution_type_id: fundedUuid,
        created_at: e.createdAt || new Date(),
        updated_at: e.updatedAt || new Date()
      };
      const { error } = await sb.from('expenditures').upsert(row, { onConflict: 'id' });
      if (error) console.warn('[mirror] expenditure:', error.message);
    }

    const receipts = await safeFind(db, 'receipts');
    for (const r of receipts) {
      const memberUuid = r.memberId ? memberUuidByMongo.get(mapId(r.memberId)) : null;
      const rid = r.receiptId || mapId(r._id);
      const row = {
        id: uuidv5(`receipt:${tenantUuid}:${rid}`, NS),
        tenant_id: tenantUuid,
        receipt_id: rid,
        receipt_type: r.receiptType || 'dues',
        member_id: memberUuid,
        member_name: r.memberName || '',
        amount: Number(r.amount) || 0,
        dues_per_month: r.duesPerMonth != null ? Number(r.duesPerMonth) : null,
        months_covered: r.monthsCovered != null ? Number(r.monthsCovered) : null,
        payment_date: r.paymentDate || new Date(),
        recorded_by: r.recordedBy || '',
        recorded_at: r.recordedAt || new Date(),
        remarks: r.remarks || '',
        payment_id: null,
        contribution_id: null,
        contribution_type_name: r.contributionTypeName || '',
        created_at: r.createdAt || new Date(),
        updated_at: r.updatedAt || new Date()
      };
      const { error } = await sb.from('receipts').upsert(row, { onConflict: 'id' });
      if (error) console.warn('[mirror] receipt:', error.message);
    }

    const reminders = await safeFind(db, 'reminders');
    for (const r of reminders) {
      const memberUuid = r.memberId ? memberUuidByMongo.get(mapId(r.memberId)) : null;
      if (!memberUuid) continue;
      const id = uuidv5(`reminder:${mapId(r._id)}`, NS);
      const row = {
        id,
        tenant_id: tenantUuid,
        member_id: memberUuid,
        email: r.email || '',
        amount_owed: Number(r.amountOwed) || 0,
        months_in_arrears: Number(r.monthsInArrears) || 0,
        scripture_ref: r.scriptureRef || null,
        scripture_text: r.scriptureText || null,
        status: r.status || 'sent',
        error: r.error || null,
        triggered_by: r.triggeredBy || 'system',
        sent_at: r.sentAt || new Date(),
        created_at: r.createdAt || new Date(),
        updated_at: r.updatedAt || new Date()
      };
      const { error } = await sb.from('reminders').upsert(row, { onConflict: 'id' });
      if (error) console.warn('[mirror] reminder:', error.message);
    }

    const activityLogs = await safeFind(db, 'activitylogs');
    for (const a of activityLogs) {
      const affectedUuid = a.affectedMember ? memberUuidByMongo.get(mapId(a.affectedMember)) : null;
      const id = uuidv5(`log:${mapId(a._id)}`, NS);
      const row = {
        id,
        tenant_id: tenantUuid,
        actor: a.actor || '',
        role: a.role || 'admin',
        action: a.action || '',
        date: a.date || new Date(),
        affected_member: affectedUuid,
        created_at: a.createdAt || new Date()
      };
      const { error } = await sb.from('activity_logs').upsert(row, { onConflict: 'id' });
      if (error) console.warn('[mirror] activity_log:', error.message);
    }

    console.log(`[mirror] ${tenant.name}: members=${members.length} synced`);
  }

  return { tenants: tenants.length };
}
