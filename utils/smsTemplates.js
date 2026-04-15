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
