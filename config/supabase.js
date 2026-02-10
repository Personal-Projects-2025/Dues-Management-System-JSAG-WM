import { createClient } from '@supabase/supabase-js';

let supabase = null;

/**
 * Get Supabase client (service role for full access).
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 */
export const getSupabase = () => {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  supabase = createClient(url, key, {
    auth: { persistSession: false }
  });
  return supabase;
};

/**
 * Check if the app is configured to use Supabase instead of MongoDB.
 */
export const useSupabase = () => {
  return process.env.USE_SUPABASE === 'true' || process.env.USE_SUPABASE === '1';
};
