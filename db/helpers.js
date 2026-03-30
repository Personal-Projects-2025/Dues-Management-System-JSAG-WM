/**
 * Map Supabase (snake_case) row to API shape (camelCase) and add _id for compatibility.
 */
export const fromRow = (row) => {
  if (!row) return null;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  }
  out._id = row.id;
  return out;
};

export const fromRows = (rows) => (rows || []).map(fromRow);

/**
 * Map API (camelCase) object to DB (snake_case) for insert/update.
 */
export const toRow = (obj, exclude = []) => {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  const skip = new Set(['id', '_id', ...exclude]);
  for (const [k, v] of Object.entries(obj)) {
    if (skip.has(k) || v === undefined) continue;
    const snake = k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    out[snake] = v;
  }
  return out;
};

/**
 * Aggregate expenditure amounts grouped by category for a tenant within a date range.
 * Returns { [category: string]: number } — category keys are trimmed; blank categories
 * are stored under 'Uncategorized'.
 */
export async function aggregateExpendituresByCategory(sb, tenantId, start, end) {
  const { data, error } = await sb()
    .from('expenditures')
    .select('category, amount')
    .eq('tenant_id', tenantId)
    .gte('date', start)
    .lte('date', end);
  if (error) throw error;
  const result = {};
  for (const row of data || []) {
    const cat = (row.category || '').trim() || 'Uncategorized';
    result[cat] = (result[cat] || 0) + Number(row.amount || 0);
  }
  return result;
}

/**
 * Aggregate expenditure amounts grouped by funded_by_contribution_type_id for a tenant/period.
 * Returns { [contributionTypeId | '__untagged__']: number }.
 * Expenditures with no fund tag are stored under the key '__untagged__'.
 */
export async function aggregateExpendituresByFund(sb, tenantId, start, end) {
  const { data, error } = await sb()
    .from('expenditures')
    .select('funded_by_contribution_type_id, amount')
    .eq('tenant_id', tenantId)
    .gte('date', start)
    .lte('date', end);
  if (error) throw error;
  const result = {};
  for (const row of data || []) {
    const key = row.funded_by_contribution_type_id || '__untagged__';
    result[key] = (result[key] || 0) + Number(row.amount || 0);
  }
  return result;
}

/**
 * Aggregate contribution amounts grouped by contribution_type_id for a tenant/period.
 * Returns { [contributionTypeId | '__untyped__']: number }.
 * Contributions with no type (should not happen, but guarded) are stored under '__untyped__'.
 */
export async function aggregateContributionsByType(sb, tenantId, start, end) {
  const { data, error } = await sb()
    .from('contributions')
    .select('contribution_type_id, amount')
    .eq('tenant_id', tenantId)
    .gte('date', start)
    .lte('date', end);
  if (error) throw error;
  const result = {};
  for (const row of data || []) {
    const key = row.contribution_type_id || '__untyped__';
    result[key] = (result[key] || 0) + Number(row.amount || 0);
  }
  return result;
}

/**
 * Calculate arrears for a member (same logic as Mongoose method).
 */
export const calculateArrears = (member) => {
  const joinDate = member.joinDate ? new Date(member.joinDate) : new Date();
  const now = new Date();
  const joinYear = joinDate.getFullYear();
  const joinMonth = joinDate.getMonth();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const totalMonthsSinceJoin = (currentYear - joinYear) * 12 + (currentMonth - joinMonth) + 1;
  return Math.max(0, totalMonthsSinceJoin - (member.monthsCovered || 0));
};
