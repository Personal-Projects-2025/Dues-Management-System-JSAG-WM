/**
 * Supabase-backed master data (tenants, users).
 */
import { getSupabase } from '../config/supabase.js';
import { fromRow, fromRows, toRow } from './helpers.js';

const sb = () => getSupabase();

// ---------- Tenants ----------
export async function getTenantById(id) {
  const { data, error } = await sb().from('tenants').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return fromRow(data);
}

export async function getTenantBySlug(slug) {
  const { data, error } = await sb().from('tenants').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return fromRow(data);
}

export async function findTenant(query) {
  let q = sb().from('tenants').select('*');
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    const col = k.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (v === null) q = q.is(col, null);
    else q = q.eq(col, v);
  }
  const { data, error } = await q;
  if (error) throw error;
  return fromRows(data);
}

export async function createTenant(fields) {
  const { databaseName, ...rest } = fields;
  const row = toRow(rest);
  const { data, error } = await sb().from('tenants').insert(row).select('*').single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateTenant(id, fields) {
  const row = toRow({ ...fields, updatedAt: new Date() }, ['id']);
  const { data, error } = await sb().from('tenants').update(row).eq('id', id).select('*').single();
  if (error) throw error;
  return fromRow(data);
}

export async function findTenants(filter = {}) {
  let q = sb().from('tenants').select('*').order('created_at', { ascending: false });
  if (filter.status) q = q.eq('status', filter.status);
  if (filter.deletedAt === null) q = q.is('deleted_at', null);
  const { data, error } = await q;
  if (error) throw error;
  return fromRows(data);
}

// ---------- Users ----------
export async function getUserById(id) {
  const { data, error } = await sb().from('users').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return fromRow(data);
}

export async function getUserByUsername(username) {
  const { data, error } = await sb().from('users').select('*').eq('username', username).maybeSingle();
  if (error) throw error;
  return fromRow(data);
}

export async function getUserByEmail(email) {
  if (!email) return null;
  const { data, error } = await sb().from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();
  if (error) throw error;
  return fromRow(data);
}

export async function createUser(fields) {
  const row = toRow(fields);
  if (row.tenant_id === '') row.tenant_id = null;
  const { data, error } = await sb().from('users').insert(row).select('*').single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateUser(id, fields) {
  const row = toRow(fields, ['id', 'passwordHash']);
  const { data, error } = await sb().from('users').update(row).eq('id', id).select('*').single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateUserPassword(id, passwordHash) {
  const { data, error } = await sb().from('users').update({ password_hash: passwordHash }).eq('id', id).select('*').single();
  if (error) throw error;
  return fromRow(data);
}

export async function findUsers(filter = {}) {
  let q = sb().from('users').select('*');
  if (filter.tenantId !== undefined) q = filter.tenantId === null ? q.is('tenant_id', null) : q.eq('tenant_id', filter.tenantId);
  const { data, error } = await q;
  if (error) throw error;
  return fromRows(data);
}

// ---------- Tenant model facade (Mongoose-like API for controllers) ----------
function withSave(tenant) {
  if (!tenant) return null;
  tenant.save = async function () {
    await updateTenant(this.id, this);
  };
  return tenant;
}

export function getTenantModelSupabase() {
  return {
    async findById(id) {
      const t = await getTenantById(id);
      return withSave(t);
    },
    async findOne(query) {
      const list = await findTenant(query);
      const t = Array.isArray(list) ? list[0] : list;
      return withSave(t ?? null);
    },
    async create(fields) {
      return createTenant(fields);
    }
  };
}
