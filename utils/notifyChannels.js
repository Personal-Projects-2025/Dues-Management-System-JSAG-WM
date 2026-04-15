import { sendEmail } from './mailer.js';
import { sendSms } from './smsNotifyGh.js';

/**
 * Tenant settings: smsNotifications defaults true when missing (mirror email).
 */
export function tenantSmsAllowed(tenant) {
  if (!tenant?.config?.settings) return true;
  const v = tenant.config.settings.smsNotifications;
  return v !== false;
}

export function tenantEmailAllowed(tenant) {
  if (!tenant?.config?.settings) return true;
  const v = tenant.config.settings.emailNotifications;
  return v !== false;
}

/**
 * Send transactional SMS if tenant allows SMS and phone present.
 */
export async function sendSmsIfAllowed({ tenant, phone, message }) {
  if (!phone || !String(phone).trim()) {
    return { status: 'missing', skipped: true };
  }
  if (!tenantSmsAllowed(tenant)) {
    return { status: 'disabled', skipped: true };
  }
  const result = await sendSms({ to: phone, message });
  if (result.skipped) return { status: 'skipped', ...result };
  if (result.ok) return { status: 'sent', ...result };
  return { status: 'failed', ...result };
}

/**
 * Send email if tenant allows and options valid (delegates to mailer).
 */
export async function sendEmailIfAllowed({ tenant, ...emailOptions }) {
  if (!tenantEmailAllowed(tenant)) {
    return { ok: true, skipped: true, reason: 'email_disabled' };
  }
  return sendEmail(emailOptions);
}
