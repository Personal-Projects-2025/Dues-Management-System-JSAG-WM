const formatCurrency = (value) => {
  if (typeof value !== 'number') {
    return value;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: process.env.CURRENCY_CODE || 'USD'
  }).format(value);
};

export const renderPaymentReceiptEmail = ({ member, receipt }) => {
  const groupName = process.env.GROUP_NAME || 'Group Dues';
  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2 style="color: #2563eb;">${groupName} &mdash; Payment Receipt</h2>
      <p>Hello ${member.name},</p>
      <p>Thank you for your payment of <strong>${formatCurrency(receipt.amount)}</strong> covering <strong>${receipt.monthsCovered}</strong> month(s) of dues.</p>
      <p>Your receipt ID is <strong>${receipt.receiptId}</strong> and was recorded on <strong>${new Date(
        receipt.paymentDate
      ).toLocaleString()}</strong> by <strong>${receipt.recordedBy}</strong>.</p>
      <p>You will find the official PDF receipt attached to this email for your records.</p>
      <p style="margin-top: 24px;">Blessings,<br/>${groupName} Accounts Team</p>
    </div>
  `;
};

export const renderPaymentReceiptText = ({ member, receipt }) => {
  const groupName = process.env.GROUP_NAME || 'Group Dues';
  return `Hello ${member.name},

Thank you for your payment of ${formatCurrency(receipt.amount)} covering ${receipt.monthsCovered} month(s) of dues.

Receipt ID: ${receipt.receiptId}
Recorded on: ${new Date(receipt.paymentDate).toLocaleString()}
Recorded by: ${receipt.recordedBy}

Your PDF receipt is attached for your records.

Blessings,
${groupName} Accounts Team`;
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

export const renderReminderEmail = ({ member, amountOwed, monthsInArrears, verse }) => {
  const groupName = process.env.GROUP_NAME || 'Group Dues';
  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2 style="color: #2563eb;">${groupName} &mdash; Monthly Dues Reminder</h2>
      <p>Hello ${member.name},</p>
      <p>As of today, your outstanding dues amount to <strong>${formatCurrency(amountOwed)}</strong>, covering <strong>${monthsInArrears}</strong> month(s).</p>
      <blockquote style="border-left: 4px solid #2563eb; margin: 16px 0; padding: 8px 16px; color: #1d4ed8;">
        <em>"${verse.text}"</em><br/>
        <strong>&mdash; ${verse.reference}</strong>
      </blockquote>
      <p>Your continued support keeps our community thriving. You can make your payment at any time through the usual channels.</p>
      <p style="margin-top: 24px;">Blessings,<br/>${groupName} Accounts Team</p>
    </div>
  `;
};

export const renderReminderText = ({ member, amountOwed, monthsInArrears, verse }) => {
  const groupName = process.env.GROUP_NAME || 'Group Dues';
  return `Hello ${member.name},

As of today, your outstanding dues amount to ${formatCurrency(amountOwed)}, covering ${monthsInArrears} month(s).

"${verse.text}"
— ${verse.reference}

Your continued support keeps our community thriving. You can make your payment at any time through the usual channels.

Blessings,
${groupName} Accounts Team`;
};



