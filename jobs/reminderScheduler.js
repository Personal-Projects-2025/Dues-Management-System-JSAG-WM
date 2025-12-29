import cron from 'node-cron';
import { sendEmail } from '../utils/mailer.js';
import { pickScriptureVerse, renderReminderEmail, renderReminderText } from '../utils/emailTemplates.js';
import { getTenantModel } from '../models/Tenant.js';
import { getTenantConnection } from '../utils/connectionManager.js';
import { getTenantModels } from '../utils/tenantModels.js';

const DEFAULT_CRON = '0 8 25 * *'; // 08:00 on the 25th of every month

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

  const members = await Member.find({ email: { $ne: null } });
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
    const reminderData = {
      memberId: member._id,
      email: member.email,
      amountOwed,
      monthsInArrears,
      scriptureRef: verse.reference,
      scriptureText: verse.text,
      triggeredBy
    };

    try {
      const monthName = new Date().toLocaleString('default', {
        month: 'long',
        year: 'numeric'
      });

      await sendEmail({
        to: [member.email],
        subject: `Monthly Dues Reminder — ${monthName} — ${groupName}`,
        htmlContent: renderReminderEmail({
          member,
          amountOwed,
          monthsInArrears,
          verse
        }),
        textContent: renderReminderText({
          member,
          amountOwed,
          monthsInArrears,
          verse
        }),
        senderName: groupName
      });

      await Reminder.create({
        ...reminderData,
        status: 'sent'
      });
      sent++;
    } catch (error) {
      console.error(`Reminder email failed for ${member.email}`, error);
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
 * Send reminders for all active tenants (system-wide)
 */
export const sendReminders = async (triggeredBy = 'system') => {
  try {
    const Tenant = await getTenantModel();
    const activeTenants = await Tenant.find({ 
      status: 'active',
      deletedAt: null
    });

    const results = [];

    for (const tenant of activeTenants) {
      try {
        const tenantConnection = await getTenantConnection(tenant.databaseName);
        const result = await sendRemindersForTenant(tenantConnection, triggeredBy, tenant);
        results.push({
          tenant: tenant.name,
          ...result
        });
      } catch (error) {
        console.error(`Failed to send reminders for tenant ${tenant.name}:`, error);
        results.push({
          tenant: tenant.name,
          error: error.message,
          processed: 0,
          sent: 0,
          failed: 0
        });
      }
    }

    // Aggregate totals
    const total = {
      processed: results.reduce((sum, r) => sum + (r.processed || 0), 0),
      sent: results.reduce((sum, r) => sum + (r.sent || 0), 0),
      failed: results.reduce((sum, r) => sum + (r.failed || 0), 0),
      triggeredBy,
      runAt: new Date(),
      tenants: results.length
    };

    return total;
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


