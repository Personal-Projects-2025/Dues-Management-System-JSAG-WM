const formatCurrency = (value) => {
  if (typeof value !== 'number') {
    return value;
  }
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: process.env.CURRENCY_CODE || 'GHS'
  }).format(value);
};

/** Resolve group name: prefer caller-supplied name, then env var, then fallback. */
const resolveGroupName = (supplied) =>
  supplied || process.env.GROUP_NAME || 'Dues Accountant';

export const renderPaymentReceiptEmail = ({ member, receipt, groupName }) => {
  const gName = resolveGroupName(groupName);
  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2 style="color: #2563eb;">${gName} &mdash; Payment Receipt</h2>
      <p>Hello ${member.name},</p>
      <p>Thank you for your payment of <strong>${formatCurrency(receipt.amount)}</strong> covering <strong>${receipt.monthsCovered}</strong> month(s) of dues.</p>
      <p>Your receipt ID is <strong>${receipt.receiptId}</strong> and was recorded on <strong>${new Date(
        receipt.paymentDate
      ).toLocaleString()}</strong> by <strong>${receipt.recordedBy}</strong>.</p>
      <p>You will find the official PDF receipt attached to this email for your records.</p>
      <p style="margin-top: 24px;">Blessings,<br/>${gName} Accounts Team</p>
    </div>
  `;
};

export const renderPaymentReceiptText = ({ member, receipt, groupName }) => {
  const gName = resolveGroupName(groupName);
  return `Hello ${member.name},

Thank you for your payment of ${formatCurrency(receipt.amount)} covering ${receipt.monthsCovered} month(s) of dues.

Receipt ID: ${receipt.receiptId}
Recorded on: ${new Date(receipt.paymentDate).toLocaleString()}
Recorded by: ${receipt.recordedBy}

Your PDF receipt is attached for your records.

Blessings,
${gName} Accounts Team`;
};

export const renderContributionReceiptEmail = ({ receipt, recipientName, groupName }) => {
  const gName = resolveGroupName(groupName);
  const typeName = receipt.contributionTypeName || 'Contribution';
  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2 style="color: #2563eb;">${gName} &mdash; Contribution Receipt</h2>
      <p>Hello ${recipientName},</p>
      <p>Please find the receipt for a contribution of <strong>${formatCurrency(receipt.amount)}</strong> (${typeName}) recorded on <strong>${new Date(receipt.paymentDate).toLocaleString()}</strong>.</p>
      <p>Receipt ID: <strong>${receipt.receiptId}</strong></p>
      <p>The official PDF receipt is attached for your records.</p>
      <p style="margin-top: 24px;">Blessings,<br/>${gName} Accounts Team</p>
    </div>
  `;
};

export const renderContributionReceiptText = ({ receipt, recipientName, groupName }) => {
  const gName = resolveGroupName(groupName);
  const typeName = receipt.contributionTypeName || 'Contribution';
  return `Hello ${recipientName},

Please find the receipt for a contribution of ${formatCurrency(receipt.amount)} (${typeName}) recorded on ${new Date(receipt.paymentDate).toLocaleString()}.

Receipt ID: ${receipt.receiptId}

The PDF receipt is attached for your records.

Blessings,
${gName} Accounts Team`;
};

export const renderRecorderReceiptEmail = ({ receipt, recipientName, paymentDescription, groupName }) => {
  const gName = resolveGroupName(groupName);
  const desc = paymentDescription || receipt.contributionTypeName || 'contribution';
  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2 style="color: #2563eb;">${gName} &mdash; Receipt (Recorded by You)</h2>
      <p>Hello ${recipientName},</p>
      <p>Please find the receipt for the ${desc} of <strong>${formatCurrency(receipt.amount)}</strong> that you recorded on <strong>${new Date(receipt.paymentDate).toLocaleString()}</strong>.</p>
      <p>Receipt ID: <strong>${receipt.receiptId}</strong></p>
      <p>The PDF receipt is attached for your records.</p>
      <p style="margin-top: 24px;">Blessings,<br/>${gName} Accounts Team</p>
    </div>
  `;
};

export const renderRecorderReceiptText = ({ receipt, recipientName, paymentDescription, groupName }) => {
  const gName = resolveGroupName(groupName);
  const desc = paymentDescription || receipt.contributionTypeName || 'contribution';
  return `Hello ${recipientName},

Please find the receipt for the ${desc} of ${formatCurrency(receipt.amount)} that you recorded on ${new Date(receipt.paymentDate).toLocaleString()}.

Receipt ID: ${receipt.receiptId}

The PDF receipt is attached for your records.

Blessings,
${gName} Accounts Team`;
};

const scriptureVerses = [
  {
    reference: 'Proverbs 3:9',
    text: 'Honor the Lord with your wealth and with the firstfruits of all your produce.'
  },
  {
    reference: '2 Corinthians 9:7',
    text: 'Each one must give as he has decided in his heart, not reluctantly or under compulsion, for God loves a cheerful giver.'
  },
  {
    reference: 'Luke 6:38',
    text: 'Give, and it will be given to you. Good measure, pressed down, shaken together, running over, will be put into your lap.'
  },
  {
    reference: 'Galatians 6:9',
    text: 'Let us not grow weary of doing good, for in due season we will reap, if we do not give up.'
  },
  {
    reference: 'Philippians 4:19',
    text: 'And my God will supply every need of yours according to his riches in glory in Christ Jesus.'
  }
];

export const pickScriptureVerse = (index = 0) => scriptureVerses[index % scriptureVerses.length];

export const renderReminderEmail = ({ member, amountOwed, monthsInArrears, verse, groupName }) => {
  const gName = resolveGroupName(groupName);
  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2 style="color: #2563eb;">${gName} &mdash; Monthly Dues Reminder</h2>
      <p>Hello ${member.name},</p>
      <p>As of today, your outstanding dues amount to <strong>${formatCurrency(amountOwed)}</strong>, covering <strong>${monthsInArrears}</strong> month(s).</p>
      <blockquote style="border-left: 4px solid #2563eb; margin: 16px 0; padding: 8px 16px; color: #1d4ed8;">
        <em>"${verse.text}"</em><br/>
        <strong>&mdash; ${verse.reference}</strong>
      </blockquote>
      <p>Your continued support keeps our community thriving. You can make your payment at any time through the usual channels.</p>
      <p style="margin-top: 24px;">Blessings,<br/>${gName} Accounts Team</p>
    </div>
  `;
};

export const renderPasswordResetOtpEmail = ({ otp, username }) => `
  <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 480px; margin: 0 auto;">
    <div style="background: #2563eb; padding: 28px 32px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">
        Dues Accountant
      </h1>
      <p style="color: #bfdbfe; margin: 6px 0 0; font-size: 13px;">Password Reset Request</p>
    </div>
    <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
      <p style="margin: 0 0 16px; font-size: 15px;">Hello <strong>${username}</strong>,</p>
      <p style="margin: 0 0 24px; font-size: 15px; color: #4b5563;">
        We received a request to reset your password. Use the verification code below to proceed.
        This code expires in <strong>15 minutes</strong>.
      </p>
      <div style="background: #f0f7ff; border: 2px dashed #93c5fd; border-radius: 10px; padding: 24px; text-align: center; margin: 0 0 24px;">
        <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 600;">
          Your Reset Code
        </p>
        <p style="margin: 0; font-size: 40px; font-weight: 800; letter-spacing: 10px; color: #1d4ed8; font-family: 'Courier New', monospace;">
          ${otp}
        </p>
      </div>
      <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">
        If you did not request a password reset, please ignore this email. Your account remains secure.
      </p>
      <p style="margin: 24px 0 0; font-size: 14px; color: #374151;">
        Blessings,<br/>
        <strong>Dues Accountant Team</strong>
      </p>
    </div>
  </div>
`;

export const renderPasswordResetOtpText = ({ otp, username }) =>
  `Hello ${username},

We received a request to reset your password. Use the verification code below. This code expires in 15 minutes.

Your Reset Code: ${otp}

If you did not request a password reset, please ignore this email.

Blessings,
Dues Accountant Team`;

export const renderReminderText = ({ member, amountOwed, monthsInArrears, verse, groupName }) => {
  const gName = resolveGroupName(groupName);
  return `Hello ${member.name},

As of today, your outstanding dues amount to ${formatCurrency(amountOwed)}, covering ${monthsInArrears} month(s).

"${verse.text}"
— ${verse.reference}

Your continued support keeps our community thriving. You can make your payment at any time through the usual channels.

Blessings,
${gName} Accounts Team`;
};
