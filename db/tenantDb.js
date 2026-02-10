/**
 * Supabase-backed tenant-scoped data access.
 * Replaces Mongoose tenant models with same API shape (find, findById, create, etc.).
 */
import { getSupabase } from '../config/supabase.js';
import { fromRow, fromRows, toRow, calculateArrears } from './helpers.js';

const sb = () => getSupabase();

/** Chainable thenable so controllers can call .populate().sort() on find() / findById() and still await. */
function chainable(promise) {
  const p = Promise.resolve(promise);
  return {
    then(onFulfilled, onRejected) { return chainable(p.then(onFulfilled, onRejected)); },
    catch(onRejected) { return chainable(p.catch(onRejected)); },
    populate() { return this; },
    sort() { return this; },
    select() { return this; }
  };
}

function toSnake(s) {
  return String(s).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

async function getSubgroupNamesByIds(tenantId, ids) {
  if (!ids || ids.length === 0) return {};
  const uniq = [...new Set(ids)];
  const { data, error } = await sb().from('subgroups').select('id, name').eq('tenant_id', tenantId).in('id', uniq);
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => { map[r.id] = fromRow(r).name; });
  return map;
}

// ---------- Members (with payment history) ----------
function memberModel(tenantId) {
  const t = tenantId;
  const model = {
    find(query = {}) {
      const promise = (async () => {
        let q = sb().from('members').select('*').eq('tenant_id', t).order('created_at', { ascending: false });
        if (query.role) q = q.eq('role', query.role);
        if (query.subgroupId != null) q = q.eq('subgroup_id', query.subgroupId);
        if (query.$or) {
          const parts = query.$or.map((c) => {
            const k = Object.keys(c)[0];
            const v = c[k];
            const col = toSnake(k);
            if (v?.$regex) return `${col}.ilike.%${String(v.$regex).replace(/^\^|\$$/g, '')}%`;
            return `${col}.eq.${v}`;
          });
          q = q.or(parts.join(','));
        }
        const { data, error } = await q;
        if (error) throw error;
        const members = fromRows(data);
        const subgroupIds = [...new Set(members.map((m) => m.subgroupId).filter(Boolean))];
        const nameMap = await getSubgroupNamesByIds(t, subgroupIds);
        for (const m of members) {
          m.paymentHistory = await getPaymentHistoryForMember(t, m.id);
          m.arrears = calculateArrears(m);
          m.calculateArrears = () => calculateArrears(m);
          m.save = async function () { return model.update(this.id, this); };
          if (m.subgroupId) m.subgroupId = { _id: m.subgroupId, id: m.subgroupId, name: nameMap[m.subgroupId] || null };
        }
        return members;
      })();
      return chainable(promise);
    },
    findById(id) {
      const promise = (async () => {
        const { data, error } = await sb().from('members').select('*').eq('tenant_id', t).eq('id', id).maybeSingle();
        if (error) throw error;
        const m = fromRow(data);
        if (!m) return null;
        m.paymentHistory = await getPaymentHistoryForMember(t, id);
        m.arrears = calculateArrears(m);
        m.calculateArrears = () => calculateArrears(m);
        m.save = async function () { return model.update(this.id, this); };
        if (m.subgroupId) {
          const nameMap = await getSubgroupNamesByIds(t, [m.subgroupId]);
          m.subgroupId = { _id: m.subgroupId, id: m.subgroupId, name: nameMap[m.subgroupId] || null };
        }
        return m;
      })();
      return chainable(promise);
    },
    async findOne(query) {
      let q = sb().from('members').select('*').eq('tenant_id', t).limit(1);
      for (const [k, v] of Object.entries(query)) if (v !== undefined) q = q.eq(k.replace(/([A-Z])/g, '_$1').toLowerCase(), v);
      const { data, error } = await q;
      if (error) throw error;
      const m = fromRow(data?.[0]);
      if (!m) return null;
      m.paymentHistory = await getPaymentHistoryForMember(t, m.id);
      m.arrears = calculateArrears(m);
      m.calculateArrears = () => calculateArrears(m);
      m.save = async function () { return model.update(this.id, this); };
      return m;
    },
    async create(fields) {
      const row = toRow({ ...fields, tenantId: t });
      const { data, error } = await sb().from('members').insert(row).select('*').single();
      if (error) throw error;
      const m = fromRow(data);
      m.paymentHistory = [];
      m.arrears = calculateArrears(m);
      m.calculateArrears = () => calculateArrears(m);
      m.save = async function () { return model.update(this.id, this); };
      return m;
    },
    async update(id, fields) {
      const row = toRow(fields, ['tenantId', 'paymentHistory']);
      const { data, error } = await sb().from('members').update(row).eq('tenant_id', t).eq('id', id).select('*').single();
      if (error) throw error;
      const m = fromRow(data);
      m.paymentHistory = await getPaymentHistoryForMember(t, id);
      m.arrears = calculateArrears(m);
      m.calculateArrears = () => calculateArrears(m);
      m.save = async function () { return model.update(this.id, this); };
      return m;
    },
    async findByIdAndUpdate(id, fields) {
      return this.update(id, fields);
    },
    async     findByIdAndDelete(id) {
      const { error } = await sb().from('members').delete().eq('tenant_id', t).eq('id', id);
      if (error) throw error;
    },
    async aggregate(pipeline) {
      // Support $group by subgroupId -> totalCollected (sum totalPaid), memberCount
      const groupStage = pipeline && pipeline.find((s) => s.$group);
      if (!groupStage || !groupStage.$group) return [];
      const g = groupStage.$group;
      if (g._id !== '$subgroupId') return [];
      const { data, error } = await sb().from('members').select('subgroup_id, total_paid').eq('tenant_id', t).not('subgroup_id', 'is', null);
      if (error) throw error;
      const rows = data || [];
      const bySubgroup = {};
      for (const r of rows) {
        const sid = r.subgroup_id;
        if (!bySubgroup[sid]) bySubgroup[sid] = { totalCollected: 0, memberCount: 0 };
        bySubgroup[sid].totalCollected += Number(r.total_paid || 0);
        bySubgroup[sid].memberCount += 1;
      }
      return Object.entries(bySubgroup).map(([_id, v]) => ({ _id, totalCollected: v.totalCollected, memberCount: v.memberCount }));
    },
    calculateArrears(member) {
      return calculateArrears(member);
    }
  };
  return model;
}

async function getPaymentHistoryForMember(tenantId, memberId) {
  const { data, error } = await sb()
    .from('payment_history')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('member_id', memberId)
    .order('date', { ascending: false });
  if (error) throw error;
  return fromRows(data);
}

// ---------- Subgroups ----------
function subgroupModel(tenantId) {
  const base = tableModel('subgroups', tenantId);
  const t = tenantId;
  return {
    ...base,
    find() {
      const promise = base.find().then((rows) => Promise.all(rows.map((r) => populateLeader({ ...r }))));
      return chainable(promise);
    },
    findById(id) {
      const promise = base.findById(id).then((row) => (row ? populateLeader(row) : null));
      return chainable(promise);
    },
    async findOne(query) {
      let q = sb().from('subgroups').select('*').eq('tenant_id', t).limit(1);
      for (const [k, v] of Object.entries(query)) if (v !== undefined) q = q.eq(toSnake(k), v);
      const { data, error } = await q;
      if (error) throw error;
      const row = fromRow(data?.[0]);
      return row ? await populateLeader(row) : null;
    }
  };
}

async function populateLeader(subgroup) {
  if (!subgroup.leaderId) return subgroup;
  const tenantId = subgroup.tenantId ?? subgroup.tenant_id;
  let q = sb().from('members').select('id, name, member_id, role, contact').eq('id', subgroup.leaderId);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data } = await q.maybeSingle();
  subgroup.leaderId = fromRow(data) || subgroup.leaderId;
  return subgroup;
}

// ---------- Generic table model ----------
function tableModel(tableName, tenantId, overrides = {}) {
  const t = tenantId;
  const base = {
    async find(query = {}) {
      let q = sb().from(tableName).select('*').eq('tenant_id', t);
      for (const [k, v] of Object.entries(query)) if (v !== undefined && k !== '$or') q = q.eq(toSnake(k), v);
      q = q.order('created_at', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return fromRows(data);
    },
    async findById(id) {
      const { data, error } = await sb().from(tableName).select('*').eq('tenant_id', t).eq('id', id).maybeSingle();
      if (error) throw error;
      return fromRow(data);
    },
    async findOne(query) {
      let q = sb().from(tableName).select('*').eq('tenant_id', t).limit(1);
      for (const [k, v] of Object.entries(query)) if (v !== undefined) q = q.eq(toSnake(k), v);
      const { data, error } = await q;
      if (error) throw error;
      return fromRow(data?.[0]);
    },
    async create(fields) {
      const row = toRow({ ...fields, tenantId: t });
      const { data, error } = await sb().from(tableName).insert(row).select('*').single();
      if (error) throw error;
      return fromRow(data);
    },
    async update(id, fields) {
      const row = toRow(fields, ['tenantId']);
      const { data, error } = await sb().from(tableName).update(row).eq('tenant_id', t).eq('id', id).select('*').single();
      if (error) throw error;
      return fromRow(data);
    },
    async findByIdAndUpdate(id, fields) {
      return this.update(id, fields);
    },
    async findByIdAndDelete(id) {
      const { error } = await sb().from(tableName).delete().eq('tenant_id', t).eq('id', id);
      if (error) throw error;
    }
  };
  return { ...base, ...overrides };
}

// ---------- Contribution types ----------
function contributionTypeModel(tenantId) {
  return tableModel('contribution_types', tenantId);
}

// ---------- Contributions ----------
function contributionModel(tenantId) {
  return tableModel('contributions', tenantId);
}

// ---------- Expenditures ----------
function expenditureModel(tenantId) {
  return tableModel('expenditures', tenantId);
}

// ---------- Receipts ----------
function receiptModel(tenantId) {
  return tableModel('receipts', tenantId);
}

// ---------- Reminders ----------
function reminderModel(tenantId) {
  return tableModel('reminders', tenantId);
}

// ---------- Activity logs ----------
function activityLogModel(tenantId) {
  return tableModel('activity_logs', tenantId);
}

// ---------- Payment history (for recording dues payments) ----------
export async function addPaymentToMember(tenantId, memberId, payment) {
  const row = {
    tenant_id: tenantId,
    member_id: memberId,
    amount: payment.amount,
    date: payment.date || new Date().toISOString(),
    months_covered: payment.monthsCovered,
    recorded_by: payment.recordedBy
  };
  const { data, error } = await sb().from('payment_history').insert(row).select('*').single();
  if (error) throw error;
  return fromRow(data);
}

/**
 * Get tenant-scoped models for the request (same shape as getTenantModels with Mongoose).
 */
export function getTenantModels(req) {
  const tenantId = req.tenantId;
  if (!tenantId) throw new Error('Tenant context (tenantId) required. Ensure tenantMiddleware ran.');
  return {
    Member: memberModel(tenantId),
    Subgroup: subgroupModel(tenantId),
    Expenditure: expenditureModel(tenantId),
    Receipt: receiptModel(tenantId),
    Reminder: reminderModel(tenantId),
    ActivityLog: activityLogModel(tenantId),
    ContributionType: contributionTypeModel(tenantId),
    Contribution: contributionModel(tenantId)
  };
}
