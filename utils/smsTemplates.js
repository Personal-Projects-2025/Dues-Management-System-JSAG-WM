/** Short SMS bodies — keep under ~320 chars for safety */

export function smsOtpEmail({ code, context = 'verification' }) {
  return `Your ${context} code is ${code}. Do not share this code.`;
}

export function smsOtpPhone({ code, context = 'phone verification' }) {
  return `Your ${context} code is ${code}. Do not share this code.`;
}

export function smsTenantRegistrationWelcome({ tenantName, groupLabel = 'Dues Accountant' }) {
  const name = (tenantName || 'your organization').slice(0, 80);
  return `Welcome to ${groupLabel}. Registration for "${name}" was received and is pending approval.`;
}

export function smsPaymentReceipt({ memberName, amount, receiptId, groupName, previewUrl }) {
  const g = (groupName || 'Dues').slice(0, 40);
  const n = (memberName || 'Member').slice(0, 40);
  let msg = `${g}: Payment of ${amount} received for ${n}. Receipt ${receiptId}. Thank you.`;
  if (previewUrl) {
    msg += ` View: ${previewUrl}`;
  }
  return msg;
}

export function smsContributionReceipt({ receiptId, amount, groupName, previewUrl }) {
  const g = (groupName || 'Dues').slice(0, 40);
  let msg = `${g}: Contribution ${amount} recorded. Receipt ${receiptId}. Thank you.`;
  if (previewUrl) {
    msg += ` View: ${previewUrl}`;
  }
  return msg;
}

/** First trimmed word of a member's full name. */
export function extractMemberFirstName(name) {
  const first = String(name || '').trim().split(/\s+/)[0];
  return first || 'Member';
}

/**
 * Personalized contribution reminder SMS for members with outstanding dues.
 * Keeps a warm, professional tone and omits optional fields when not provided.
 */
export function smsContributionReminder({
  tenantName,
  memberFirstName,
  outstandingAmount,
  currency,
  paymentMethod,
  paymentAccount,
  paymentAccountName,
  paymentReference = 'Dues',
  closingBlessing = 'God bless you.',
}) {
  const org = (tenantName || 'Organization').trim();
  const firstName = (memberFirstName || 'Member').trim();
  const amount = String(outstandingAmount ?? '0.00');
  const curr = (currency || 'GHS').trim();
  const method = (paymentMethod || '').trim();
  const account = (paymentAccount || '').trim();
  const accountName = (paymentAccountName || '').trim();
  const reference = (paymentReference || 'Dues').trim();
  const blessing = (closingBlessing || 'God bless you.').trim();

  const accountLabel = accountName ? `${account} (${accountName})` : account;

  const lines = [
    org,
    '',
    `Dear ${firstName},`,
    '',
    'Thank you for your continued support.',
    '',
    `Kindly be reminded of your outstanding dues of ${curr} ${amount}.`,
    '',
    `Contributions can be sent via ${method} to ${accountLabel}. Kindly use "${reference}" as the payment reference.`,
    '',
    blessing,
    '',
    `The ${org} Finance Committee`,
  ];

  return lines.join('\n');
}

/** @deprecated Use smsContributionReminder for dues reminders. */
export function smsReminder({ memberName, amountOwed, monthsInArrears, groupName }) {
  const g = (groupName || 'Dues').slice(0, 36);
  const n = (memberName || 'Member').slice(0, 36);
  return `${g}: Reminder — ${n}, dues owed approx. ${amountOwed} (${monthsInArrears} mo). Please arrange payment.`;
}

export function smsAppreciation({ memberName, groupName }) {
  const g = (groupName || 'Dues').slice(0, 44);
  const n = (memberName || 'Member').slice(0, 44);
  return `${g}: Thank you ${n} for your faithful contributions.`;
}
