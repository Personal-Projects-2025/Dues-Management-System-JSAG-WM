import cron from 'node-cron';
import { pickScriptureVerse, renderReminderEmail, renderReminderText } from '../utils/emailTemplates.js';
import { sendEmailIfAllowed, sendSmsIfAllowed, tenantEmailAllowed, tenantSmsAllowed } from '../utils/notifyChannels.js';
import { smsReminder } from '../utils/smsTemplates.js';
import { getTenantModel } from '../models/Tenant.js';
import { getTenantConnection } from '../utils/connectionManager.js';
import { getTenantModels } from '../utils/tenantModels.js';
import { useSupabase } from '../config/supabase.js';
import * as masterDb from '../db/masterDb.js';

// Runs every day at 08:00; only sends for tenants whose reminderDay matches today
const DEFAULT_CRON = '0 8 * * *';

const calculateAmountOwed = (member) => {
  const arrears = member.calculateArrears();
  if (arrears <= 0) {
    return {
      monthsInArrears: 0,
      amountOwed: 0
    };
  }

  const amountOwed = arrears * member.duesPerMonth;
  return {
    monthsInArrears: arrears,
    amountOwed
  };
};

/**
 * Send reminders for a specific tenant
 * @param {mongoose.Connection} tenantConnection - Tenant database connection
 * @param {string} triggeredBy - 'system' or 'manual'
 * @param {Object} tenant - Tenant object (optional, for branding)
 */
export const sendRemindersForTenant = async (tenantConnection, triggeredBy = 'system', tenant = null) => {
  // Get tenant models
  const Member = tenantConnection.models.Member;
  const Reminder = tenantConnection.models.Reminder;

  if (!Member || !Reminder) {
    throw new Error('Tenant models not initialized');
  }

  if (tenant?.config?.settings?.reminderEnabled === false) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      triggeredBy,
      runAt: new Date(),
      skipped: 'reminders_disabled'
    };
  }

  const members = await Member.find({
    $or: [
      { email: { $nin: [null, ''] } },
      { phone: { $nin: [null, ''] } }
    ]
  });
  let verseIndex = 0;

  let processed = 0;
  let sent = 0;
  let failed = 0;

  const groupName = tenant?.config?.branding?.name || tenant?.name || 'Dues Accountant';

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const { monthsInArrears, amountOwed } = calculateAmountOwed(member);

    if (monthsInArrears <= 0) {
      continue;
    }

    processed++;

    const verse = pickScriptureVerse(verseIndex++);
    const reminderEmail = member.email || (member.phone ? `sms:${member.phone}` : '');

    const reminderData = {
      memberId: member._id,
      email: reminderEmail,
      amountOwed,
      monthsInArrears,
      scriptureRef: verse.reference,
      scriptureText: verse.text,
      triggeredBy
    };

    const monthName = new Date().toLocaleString('default', {
      month: 'long',
      year: 'numeric'
    });

    let emailOk = false;
    let smsOk = false;

    try {
      if (member.email && tenantEmailAllowed(tenant)) {
        const er = await sendEmailIfAllowed({
          tenant,
          to: [member.email],
          subject: `Monthly Dues Reminder — ${monthName} — ${groupName}`,
          htmlContent: renderReminderEmail({
            member,
            amountOwed,
            monthsInArrears,
            verse,
            groupName
          }),
          textContent: renderReminderText({
            member,
            amountOwed,
            monthsInArrears,
            verse,
            groupName
          }),
          senderName: groupName
        });
        emailOk = !er.skipped;
      }

      if (member.phone && tenantSmsAllowed(tenant)) {
        const smsRes = await sendSmsIfAllowed({
          tenant,
          phone: member.phone,
          message: smsReminder({
            memberName: member.name,
            amountOwed: String(amountOwed.toFixed(2)),
            monthsInArrears,
            groupName
          })
        });
        if (smsRes.status === 'sent') smsOk = true;
      }

      if (emailOk || smsOk) {
        await Reminder.create({
          ...reminderData,
          status: 'sent'
        });
        sent++;
      } else {
        await Reminder.create({
          ...reminderData,
          status: 'failed',
          error: 'No email/phone or notifications disabled'
        });
        failed++;
      }
    } catch (error) {
      console.error(`Reminder failed for ${member.email || member.phone}`, error);
      await Reminder.create({
        ...reminderData,
        status: 'failed',
        error: error.message
      });
      failed++;
    }
  }

  return {
    processed,
    sent,
    failed,
    triggeredBy,
    runAt: new Date()
  };
};

/**
 * Send reminders for all active tenants whose reminderDay matches today (system-wide).
 * When triggeredBy is 'manual', skip the day-of-month check and send immediately.
 */
export const sendReminders = async (triggeredBy = 'system') => {
  try {
    const todayDay = new Date().getDate();
    const results = [];

    if (useSupabase()) {
      const activeTenants = await masterDb.findTenants({ status: 'active', deletedAt: null });
      for (const tenant of activeTenants) {
        try {
          const reminderDay = tenant.config?.settings?.reminderDay ?? 25;
          if (triggeredBy === 'system' && todayDay !== reminderDay) continue;

          const fakeReq = { tenantId: tenant.id, tenantConnection: { _supabase: true }, tenant };
          const { Member, Reminder } = getTenantModels(fakeReq);
          const result = await sendRemindersForTenant({ models: { Member, Reminder } }, triggeredBy, tenant);
          results.push({ tenant: tenant.name, ...result });
        } catch (error) {
          console.error(`Failed to send reminders for tenant ${tenant.name}:`, error);
          results.push({ tenant: tenant.name, error: error.message, processed: 0, sent: 0, failed: 0 });
        }
      }
    } else {
      const Tenant = await getTenantModel();
      const activeTenants = await Tenant.find({ status: 'active', deletedAt: null });
      for (const tenant of activeTenants) {
        try {
          const reminderDay = tenant.config?.settings?.reminderDay ?? 25;
          if (triggeredBy === 'system' && todayDay !== reminderDay) continue;

          const tenantConnection = await getTenantConnection(tenant.databaseName);
          const result = await sendRemindersForTenant(tenantConnection, triggeredBy, tenant);
          results.push({ tenant: tenant.name, ...result });
        } catch (error) {
          console.error(`Failed to send reminders for tenant ${tenant.name}:`, error);
          results.push({ tenant: tenant.name, error: error.message, processed: 0, sent: 0, failed: 0 });
        }
      }
    }

    return {
      processed: results.reduce((sum, r) => sum + (r.processed || 0), 0),
      sent: results.reduce((sum, r) => sum + (r.sent || 0), 0),
      failed: results.reduce((sum, r) => sum + (r.failed || 0), 0),
      triggeredBy,
      runAt: new Date(),
      tenants: results.length
    };
  } catch (error) {
    console.error('Error sending reminders:', error);
    throw error;
  }
};

export const initReminderScheduler = () => {
  if (process.env.ENABLE_REMINDER_CRON === 'false') {
    return;
  }

  const cronExpression = process.env.REMINDER_CRON || DEFAULT_CRON;

  cron.schedule(cronExpression, async () => {
    try {
      await sendReminders('system');
    } catch (error) {
      console.error('Monthly reminder cron failed', error);
    }
  });
};


