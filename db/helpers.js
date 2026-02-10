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
