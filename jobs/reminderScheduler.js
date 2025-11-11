import cron from 'node-cron';
import Member from '../models/Member.js';
import Reminder from '../models/Reminder.js';
import { sendEmail } from '../utils/mailer.js';
import { pickScriptureVerse, renderReminderEmail, renderReminderText } from '../utils/emailTemplates.js';

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

export const sendReminders = async (triggeredBy = 'system') => {
  const members = await Member.find({ email: { $ne: null } });
  let verseIndex = 0;

  let processed = 0;
  let sent = 0;
  let failed = 0;

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
        subject: `Monthly Dues Reminder — ${monthName}`,
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
        })
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


