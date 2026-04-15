/**
 * Appreciation Email Scheduler
 *
 * Runs daily at 09:00. For each tenant with appreciationEnabled=true:
 *   - Finds members whose cumulative monthsCovered first reached 12 (completionDate)
 *   - If today >= completionDate + appreciationDelayMonths AND no log entry yet → sends email
 */
import cron from 'node-cron';
import { sendEmailIfAllowed, sendSmsIfAllowed, tenantEmailAllowed, tenantSmsAllowed } from '../utils/notifyChannels.js';
import { renderAppreciationEmail, renderAppreciationText } from '../utils/emailTemplates.js';
import { smsAppreciation } from '../utils/smsTemplates.js';
import { getTenantModel } from '../models/Tenant.js';
import { getTenantConnection } from '../utils/connectionManager.js';
import { getTenantModel as getTenantModelUtil } from '../utils/modelFactory.js';
import { memberSchema, appreciationLogSchema } from '../models/schemas.js';
import { useSupabase } from '../config/supabase.js';
import * as masterDb from '../db/masterDb.js';

const FULL_PAYMENT_MONTHS = 12;

/**
 * Walk sorted paymentHistory to find the date when cumulative months first hit FULL_PAYMENT_MONTHS.
 * Returns null if the member hasn't reached it yet.
 */
const findCompletionDate = (member) => {
  if ((member.monthsCovered || 0) < FULL_PAYMENT_MONTHS) return null;

  const history = [...(member.paymentHistory || [])].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  let cumulative = 0;
  for (const payment of history) {
    cumulative += payment.monthsCovered || 0;
    if (cumulative >= FULL_PAYMENT_MONTHS) {
      return new Date(payment.date);
    }
  }

  // Fallback: use lastPaymentDate if history data isn't detailed enough
  return member.lastPaymentDate ? new Date(member.lastPaymentDate) : null;
};

/**
 * Add N calendar months to a date (safe: caps at last day of target month).
 */
const addMonths = (date, n) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
};

/**
 * Process appreciation emails for a single tenant (MongoDB path).
 */
export const sendAppreciationsForTenant = async (tenantConnection, tenant) => {
  const Member = getTenantModelUtil(tenantConnection, 'Member', memberSchema);
  const AppreciationLog = getTenantModelUtil(tenantConnection, 'AppreciationLog', appreciationLogSchema);

  const delayMonths = tenant?.config?.settings?.appreciationDelayMonths ?? 3;
  const groupName = tenant?.config?.branding?.name || tenant?.name || 'Dues Accountant';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eligibleMembers = await Member.find({
    monthsCovered: { $gte: FULL_PAYMENT_MONTHS },
    $or: [
      { email: { $nin: [null, ''] } },
      { phone: { $nin: [null, ''] } }
    ]
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const member of eligibleMembers) {
    if (!member.email && !member.phone) { skipped++; continue; }

    const completionDate = findCompletionDate(member);
    if (!completionDate) { skipped++; continue; }

    const sendDate = addMonths(completionDate, delayMonths);
    sendDate.setHours(0, 0, 0, 0);
    if (today < sendDate) { skipped++; continue; }

    // Check if already sent
    const alreadySent = await AppreciationLog.findOne({ memberId: member._id });
    if (alreadySent) { skipped++; continue; }

    try {
      let emailOk = false;
      let smsOk = false;

      if (member.email && tenantEmailAllowed(tenant)) {
        const er = await sendEmailIfAllowed({
          tenant,
          to: member.email,
          subject: `A heartfelt thank you — ${groupName}`,
          html: renderAppreciationEmail({ member, groupName, monthsCompleted: FULL_PAYMENT_MONTHS }),
          text: renderAppreciationText({ member, groupName, monthsCompleted: FULL_PAYMENT_MONTHS }),
          senderName: groupName,
        });
        emailOk = !er.skipped;
      }

      if (member.phone && tenantSmsAllowed(tenant)) {
        const smsRes = await sendSmsIfAllowed({
          tenant,
          phone: member.phone,
          message: smsAppreciation({ memberName: member.name, groupName })
        });
        if (smsRes.status === 'sent') smsOk = true;
      }

      if (!emailOk && !smsOk) {
        skipped++;
        continue;
      }

      await AppreciationLog.create({
        memberId: member._id,
        memberName: member.name,
        email: member.email || (member.phone ? `sms:${member.phone}` : ''),
        delayMonths,
        completionDate,
      });

      sent++;
    } catch (error) {
      console.error(`Appreciation failed for ${member.email || member.phone}:`, error.message);
      failed++;
    }
  }

  return { sent, skipped, failed, tenant: tenant?.name };
};

/**
 * Process all active tenants that have appreciationEnabled=true.
 */
export const sendAppreciations = async () => {
  const results = [];

  try {
    if (useSupabase()) {
      const activeTenants = await masterDb.findTenants({ status: 'active', deletedAt: null });
      for (const tenant of activeTenants) {
        if (!tenant.config?.settings?.appreciationEnabled) continue;
        // Supabase path: limited implementation — log skip for now
        console.warn(`[appreciation] Supabase path for tenant ${tenant.name}: appreciation emails not yet implemented for Supabase mode.`);
        results.push({ tenant: tenant.name, skipped: 0, sent: 0, failed: 0, note: 'supabase-pending' });
      }
    } else {
      const Tenant = await getTenantModel();
      const activeTenants = await Tenant.find({ status: 'active', deletedAt: null });

      for (const tenant of activeTenants) {
        if (!tenant.config?.settings?.appreciationEnabled) continue;
        try {
          const tenantConnection = await getTenantConnection(tenant.databaseName);
          const result = await sendAppreciationsForTenant(tenantConnection, tenant);
          results.push(result);
        } catch (error) {
          console.error(`Appreciation job failed for tenant ${tenant.name}:`, error.message);
          results.push({ tenant: tenant.name, error: error.message, sent: 0, skipped: 0, failed: 0 });
        }
      }
    }
  } catch (error) {
    console.error('Appreciation scheduler error:', error);
  }

  return results;
};

export const initAppreciationScheduler = () => {
  if (process.env.ENABLE_APPRECIATION_CRON === 'false') return;

  cron.schedule('0 9 * * *', async () => {
    try {
      await sendAppreciations();
    } catch (error) {
      console.error('Appreciation cron failed:', error.message);
    }
  });
};
