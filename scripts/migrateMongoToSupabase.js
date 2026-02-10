/**
 * Migrate data from MongoDB to Supabase (no data is deleted from MongoDB).
 * Run this AFTER you have a Supabase project and have run supabase/schema.sql.
 *
 * Prerequisites:
 *   - MongoDB still running and .env has MONGODB_URI (and MASTER_DB_NAME if used)
 *   - Supabase project created, schema.sql run, .env has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage: node scripts/migrateMongoToSupabase.js
 *
 * Keep USE_SUPABASE=false when you run this. It reads from MongoDB and writes to Supabase.
 */

import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { connectMasterDB } from '../config/db.js';
import { getTenantConnection } from '../utils/connectionManager.js';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
if (SUPABASE_URL.includes('.supabase.com')) {
  console.error('SUPABASE_URL must use .supabase.co (not .com). Fix it in .env and try again.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Maps: MongoDB ObjectId string -> Supabase UUID
const tenantIdMap = new Map();
const userIdMap = new Map();
const memberIdMaps = new Map(); // per tenant: Map(mongoId -> uuid)
const subgroupIdMaps = new Map();
const contributionTypeIdMaps = new Map();

function uuid() {
  return randomUUID();
}

function mapId(mongoId) {
  return mongoId ? mongoId.toString() : null;
}

async function run() {
  console.log('Connecting to MongoDB...');
  const masterConn = await connectMasterDB();
  const masterDb = masterConn.db;

  // ---------- 1. Tenants ----------
  const tenants = await masterDb.collection('tenants').find({}).toArray();
  console.log(`Found ${tenants.length} tenant(s)`);

  for (const t of tenants) {
    const id = uuid();
    tenantIdMap.set(mapId(t._id), id);
    const row = {
      id,
      name: t.name || '',
      slug: t.slug || '',
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
    const { error } = await supabase.from('tenants').upsert(row, { onConflict: 'id' });
    if (error) {
      console.error('Tenant insert error:', t.name, error);
      throw error;
    }
  }
  console.log('Tenants migrated.');

  // ---------- 2. Users ----------
  const users = await masterDb.collection('users').find({}).toArray();
  console.log(`Found ${users.length} user(s)`);

  for (const u of users) {
    const id = uuid();
    userIdMap.set(mapId(u._id), id);
    const tenantUuid = u.tenantId ? tenantIdMap.get(mapId(u.tenantId)) : null;
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
    const { error } = await supabase.from('users').upsert(row, { onConflict: 'id' });
    if (error) {
      console.error('User insert error:', u.username, error);
      throw error;
    }
  }
  console.log('Users migrated.');

  // ---------- 3. Per-tenant data ----------
  for (const tenant of tenants) {
    const tenantUuid = tenantIdMap.get(mapId(tenant._id));
    const dbName = tenant.databaseName;
    if (!dbName) {
      console.warn(`Tenant ${tenant.name} has no databaseName, skipping tenant data.`);
      continue;
    }

    console.log(`Migrating tenant: ${tenant.name} (${dbName})...`);
    const memberIdMap = new Map();
    memberIdMaps.set(tenantUuid, memberIdMap);
    const subgroupIdMap = new Map();
    subgroupIdMaps.set(tenantUuid, subgroupIdMap);
    const contributionTypeIdMap = new Map();
    contributionTypeIdMaps.set(tenantUuid, contributionTypeIdMap);

    let conn;
    try {
      conn = await getTenantConnection(dbName);
    } catch (e) {
      console.warn(`Could not connect to tenant DB ${dbName}:`, e.message);
      continue;
    }
    const db = conn.db;

    const safeFind = async (name) => {
      try {
        return await db.collection(name).find({}).toArray();
      } catch (e) {
        console.warn(`  Collection ${name} missing or error:`, e.message);
        return [];
      }
    };

    // Members (first pass: no subgroup_id)
    const members = await safeFind('members');
    for (const m of members) {
      const id = uuid();
      memberIdMap.set(mapId(m._id), id);
    }
    for (const m of members) {
      const id = memberIdMap.get(mapId(m._id));
      const subgroupUuid = null;
      const row = {
        id,
        tenant_id: tenantUuid,
        name: m.name || '',
        member_id: m.memberId || null,
        subgroup_id: subgroupUuid,
        contact: m.contact || null,
        email: m.email || null,
        role: m.role || 'member',
        join_date: m.joinDate || new Date(),
        dues_per_month: Number(m.duesPerMonth) || 0,
        total_paid: Number(m.totalPaid) || 0,
        months_covered: Number(m.monthsCovered) || 0,
        arrears: Number(m.arrears) || 0,
        last_payment_date: m.lastPaymentDate || null,
        is_auto_generated_id: m.isAutoGeneratedId || false,
        created_at: m.createdAt || new Date(),
        updated_at: m.updatedAt || new Date()
      };
      const { error } = await supabase.from('members').insert(row);
      if (error) {
        console.error('Member insert error:', m.name, error);
        throw error;
      }
    }

    // Subgroups (need leader_id -> member uuid)
    const subgroups = await safeFind('subgroups');
    for (const s of subgroups) {
      const id = uuid();
      subgroupIdMap.set(mapId(s._id), id);
    }
    for (const s of subgroups) {
      const id = subgroupIdMap.get(mapId(s._id));
      const leaderUuid = s.leaderId ? memberIdMap.get(mapId(s.leaderId)) : null;
      if (!leaderUuid) {
        console.warn(`Subgroup ${s.name} has no valid leader_id, skipping.`);
        continue;
      }
      const row = {
        id,
        tenant_id: tenantUuid,
        name: s.name || '',
        leader_id: leaderUuid,
        created_by: null,
        created_at: s.createdAt || new Date(),
        updated_at: s.updatedAt || new Date()
      };
      const { error } = await supabase.from('subgroups').insert(row);
      if (error) {
        console.error('Subgroup insert error:', s.name, error);
        throw error;
      }
    }

    // Update members with subgroup_id
    for (const m of members) {
      if (!m.subgroupId) continue;
      const memberUuid = memberIdMap.get(mapId(m._id));
      const subgroupUuid = subgroupIdMap.get(mapId(m.subgroupId));
      if (!memberUuid || !subgroupUuid) continue;
      await supabase.from('members').update({ subgroup_id: subgroupUuid }).eq('id', memberUuid);
    }

    // Payment history (from embedded member.paymentHistory)
    for (const m of members) {
      const memberUuid = memberIdMap.get(mapId(m._id));
      const history = m.paymentHistory || [];
      for (const h of history) {
        const row = {
          id: uuid(),
          tenant_id: tenantUuid,
          member_id: memberUuid,
          amount: Number(h.amount) || 0,
          date: h.date || new Date(),
          months_covered: Number(h.monthsCovered) || 0,
          recorded_by: h.recordedBy || '',
          created_at: h.date || new Date()
        };
        const { error } = await supabase.from('payment_history').insert(row);
        if (error) console.warn('Payment history insert warning:', error.message);
      }
    }

    // Contribution types (Mongoose default collection: contributiontypes)
    const contributionTypes = await safeFind('contributiontypes');
    for (const c of contributionTypes) {
      const id = uuid();
      contributionTypeIdMap.set(mapId(c._id), id);
    }
    for (const c of contributionTypes) {
      const id = contributionTypeIdMap.get(mapId(c._id));
      const row = {
        id,
        tenant_id: tenantUuid,
        name: c.name || '',
        description: c.description || null,
        is_system: c.isSystem || false,
        created_at: c.createdAt || new Date(),
        updated_at: c.updatedAt || new Date()
      };
      const { error } = await supabase.from('contribution_types').insert(row);
      if (error) {
        console.error('ContributionType insert error:', c.name, error);
        throw error;
      }
    }

    // Contributions
    const contributions = await safeFind('contributions');
    for (const c of contributions) {
      const typeUuid = contributionTypeIdMap.get(mapId(c.contributionTypeId));
      const memberUuid = c.memberId ? memberIdMap.get(mapId(c.memberId)) : null;
      const row = {
        id: uuid(),
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
      const { error } = await supabase.from('contributions').insert(row);
      if (error) console.warn('Contribution insert warning:', error.message);
    }

    // Expenditures
    const expenditures = await safeFind('expenditures');
    for (const e of expenditures) {
      const fundedUuid = e.fundedByContributionTypeId
        ? contributionTypeIdMap.get(mapId(e.fundedByContributionTypeId))
        : null;
      const row = {
        id: uuid(),
        tenant_id: tenantUuid,
        expense_id: e.expenseId || uuid(),
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
      const { error } = await supabase.from('expenditures').insert(row);
      if (error) console.warn('Expenditure insert warning:', error.message);
    }

    // Receipts
    const receipts = await safeFind('receipts');
    for (const r of receipts) {
      const memberUuid = r.memberId ? memberIdMap.get(mapId(r.memberId)) : null;
      const row = {
        id: uuid(),
        tenant_id: tenantUuid,
        receipt_id: r.receiptId || uuid(),
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
      const { error } = await supabase.from('receipts').insert(row);
      if (error) console.warn('Receipt insert warning:', error.message);
    }

    // Reminders
    const reminders = await safeFind('reminders');
    for (const r of reminders) {
      const memberUuid = r.memberId ? memberIdMap.get(mapId(r.memberId)) : null;
      if (!memberUuid) continue;
      const row = {
        id: uuid(),
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
      const { error } = await supabase.from('reminders').insert(row);
      if (error) console.warn('Reminder insert warning:', error.message);
    }

    // Activity logs (Mongoose default: activitylogs)
    const activityLogs = await safeFind('activitylogs');
    for (const a of activityLogs) {
      const affectedUuid = a.affectedMember ? memberIdMap.get(mapId(a.affectedMember)) : null;
      const row = {
        id: uuid(),
        tenant_id: tenantUuid,
        actor: a.actor || '',
        role: a.role || 'admin',
        action: a.action || '',
        date: a.date || new Date(),
        affected_member: affectedUuid,
        created_at: a.createdAt || new Date()
      };
      const { error } = await supabase.from('activity_logs').insert(row);
      if (error) console.warn('Activity log insert warning:', error.message);
    }

    console.log(`  Members: ${members.length}, Subgroups: ${subgroups.length}, Contributions: ${contributions.length}, Receipts: ${receipts.length}`);
  }

  console.log('\nMigration complete. No data was removed from MongoDB.');
  console.log('Next: set USE_SUPABASE=true in .env and restart the app to use Supabase.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
