/**
 * NotifyGH SMS API — https://sms.smsnotifygh.com
 * Response codes: 1000 ok, 1002 fail, 1003 balance, 1004 key, 1005 phone, 1006 sender, 1007 scheduled, 1008 empty
 */

const cleanEnv = (value) => {
  if (!value) return '';
  return String(value).trim().replace(/^['"]|['"]$/g, '');
};

const SMS_ENABLED = cleanEnv(process.env.SMS_ENABLED || 'false').toLowerCase() === 'true';
const SMS_API_KEY = cleanEnv(process.env.SMS_NOTIFYGH_API_KEY);
const SMS_SENDER_ID = cleanEnv(process.env.SMS_NOTIFYGH_SENDER_ID);
const SMS_BASE = cleanEnv(process.env.SMS_NOTIFYGH_BASE_URL) || 'https://sms.smsnotifygh.com';

export const SMS_RESPONSE_CODES = {
  SUCCESS: 1000,
  SEND_FAILED: 1002,
  INSUFFICIENT_BALANCE: 1003,
  INVALID_KEY: 1004,
  INVALID_PHONE: 1005,
  INVALID_SENDER_ID: 1006,
  SCHEDULED: 1007,
  EMPTY_MESSAGE: 1008
};

/**
 * Strip non-digits; normalize Ghana local 0XXXXXXXXX to 233XXXXXXXXX.
 * Returns digits only string suitable for API, or null if unusable.
 */
export function normalizeGhanaPhone(input) {
  if (!input || typeof input !== 'string') return null;
  let d = input.replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('233')) {
    return d.length >= 12 ? d : null;
  }
  if (d.startsWith('0') && d.length === 10) {
    return `233${d.slice(1)}`;
  }
  if (d.length === 9 && /^[2-5]/.test(d)) {
    return `233${d}`;
  }
  return d.length >= 10 ? d : null;
}

function maskPhone(digits) {
  if (!digits || digits.length < 6) return '***';
  return `${digits.slice(0, 4)}***${digits.slice(-2)}`;
}

function parseResponseCode(text) {
  if (text == null) return null;
  const s = String(text).trim();
  const m = s.match(/\b(100[0-9]|10[01][0-9])\b/);
  if (m) return parseInt(m[1], 10);
  const n = parseInt(s, 10);
  if (!Number.isNaN(n) && n >= 1000 && n <= 1099) return n;
  return null;
}

/**
 * @returns {{ ok: boolean, code: number|null, raw: string, skipped?: boolean }}
 */
export async function sendSms({ to, message }) {
  if (!SMS_ENABLED) {
    return { ok: true, skipped: true, code: null, raw: '' };
  }
  if (!SMS_API_KEY || !SMS_SENDER_ID) {
    console.warn('SMS_NOTIFYGH_API_KEY or SMS_NOTIFYGH_SENDER_ID missing — SMS not sent');
    return { ok: false, code: SMS_RESPONSE_CODES.INVALID_KEY, raw: 'missing_config' };
  }
  const normalized = normalizeGhanaPhone(to) || to.replace(/\D/g, '');
  if (!normalized || normalized.length < 9) {
    console.warn('Invalid phone for SMS', maskPhone(String(to)));
    return { ok: false, code: SMS_RESPONSE_CODES.INVALID_PHONE, raw: 'invalid_phone' };
  }
  const msg = String(message || '').trim();
  if (!msg) {
    return { ok: false, code: SMS_RESPONSE_CODES.EMPTY_MESSAGE, raw: 'empty_message' };
  }

  const url = new URL(`${SMS_BASE.replace(/\/$/, '')}/smsapi`);
  url.searchParams.set('key', SMS_API_KEY);
  url.searchParams.set('to', normalized);
  url.searchParams.set('msg', msg);
  url.searchParams.set('sender_id', SMS_SENDER_ID.slice(0, 11));

  try {
    const res = await fetch(url.toString(), { method: 'GET' });
    const raw = await res.text();
    const code = parseResponseCode(raw);
    const ok = code === SMS_RESPONSE_CODES.SUCCESS || code === SMS_RESPONSE_CODES.SCHEDULED;
    if (!ok) {
      console.warn('NotifyGH SMS failed', { code: code ?? raw, to: maskPhone(normalized) });
    }
    return { ok, code: code ?? null, raw };
  } catch (e) {
    console.error('NotifyGH SMS request error', e.message);
    return { ok: false, code: SMS_RESPONSE_CODES.SEND_FAILED, raw: e.message };
  }
}

/**
 * @returns {{ ok: boolean, balance?: string, raw: string, code?: number|null }}
 */
export async function getSmsBalance() {
  if (!SMS_ENABLED || !SMS_API_KEY) {
    return { ok: false, raw: 'sms_disabled_or_missing_key' };
  }
  const url = `${SMS_BASE.replace(/\/$/, '')}/api/smsapibalance?key=${encodeURIComponent(SMS_API_KEY)}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    const raw = await res.text();
    const code = parseResponseCode(raw);
    return { ok: res.ok, code: code ?? null, raw, balance: raw };
  } catch (e) {
    return { ok: false, raw: e.message };
  }
}

export function isSmsEnabled() {
  return SMS_ENABLED && Boolean(SMS_API_KEY && SMS_SENDER_ID);
}
