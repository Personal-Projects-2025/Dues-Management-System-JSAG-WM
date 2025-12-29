import { getTenantModels } from '../utils/tenantModels.js';
import { sendRemindersForTenant } from '../jobs/reminderScheduler.js';

const calculateNextReminderDate = () => {
  const now = new Date();
  const next = new Date(now);

  if (now.getDate() > 25 || (now.getDate() === 25 && now.getHours() >= 8)) {
    next.setMonth(next.getMonth() + 1);
  }

  next.setDate(25);
  next.setHours(8, 0, 0, 0);
  return next;
};

export const triggerReminders = async (req, res) => {
  try {
    const summary = await sendRemindersForTenant(req.tenantConnection, 'manual', req.tenant);
    res.json({
      message: 'Reminder emails processed',
      summary
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getReminderLogs = async (req, res) => {
  try {
    const { Reminder } = getTenantModels(req);
    const { limit = 50, status, memberId } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    if (memberId) {
      query.memberId = memberId;
    }

    const reminders = await Reminder.find(query)
      .sort({ sentAt: -1 })
      .limit(Number(limit))
      .populate('memberId', 'name email memberId');

    res.json(reminders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getReminderSummary = async (req, res) => {
  try {
    const { Reminder, Member } = getTenantModels(req);
    const lastReminder = await Reminder.findOne().sort({ sentAt: -1 });
    let totalOutstandingMembers = 0;
    let totalOutstandingAmount = 0;

    const members = await Member.find({ email: { $ne: null } });
    members.forEach((member) => {
      const arrears = member.calculateArrears();
      if (arrears > 0) {
        totalOutstandingMembers += 1;
        totalOutstandingAmount += arrears * member.duesPerMonth;
      }
    });

    res.json({
      lastReminderSentAt: lastReminder?.sentAt || null,
      nextReminderScheduledAt: calculateNextReminderDate(),
      totalOutstandingMembers,
      totalOutstandingAmount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


