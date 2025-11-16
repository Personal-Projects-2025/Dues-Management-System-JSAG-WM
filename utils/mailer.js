import SibApiV3Sdk from 'sib-api-v3-sdk';
import nodemailer from 'nodemailer';

const client = SibApiV3Sdk.ApiClient.instance;
const apiKeyAuth = client.authentications['api-key'];

const getTransactionalApi = () => {
  if (!process.env.BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is not configured');
  }

  if (!apiKeyAuth.apiKey) {
    apiKeyAuth.apiKey = process.env.BREVO_API_KEY;
  }

  return new SibApiV3Sdk.TransactionalEmailsApi();
};

let smtpTransporter = null;
const getSmtpTransporter = () => {
  if (!smtpTransporter) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

    if (!host || !user || !pass) {
      throw new Error('SMTP is not configured. Missing SMTP_HOST, SMTP_USER or SMTP_PASSWORD');
    }

    smtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });
  }
  return smtpTransporter;
};

const toBase64 = (data) => {
  if (!data) {
    return undefined;
  }
  if (Buffer.isBuffer(data)) {
    return data.toString('base64');
  }
  if (typeof data === 'string') {
    return Buffer.from(data).toString('base64');
  }
  throw new Error('Unsupported attachment content type');
};

const sendViaApi = async ({
  to,
  subject,
  htmlContent,
  textContent,
  attachments = [],
  replyTo
}) => {
  const senderEmail = process.env.EMAIL_FROM_ADDRESS;
  const senderName = process.env.EMAIL_FROM_NAME || 'Group Dues';
  const recipients = Array.isArray(to) ? to : [to];

  const email = new SibApiV3Sdk.SendSmtpEmail({
    sender: { email: senderEmail, name: senderName },
    to: recipients.map((recipient) => (typeof recipient === 'string' ? { email: recipient } : recipient)),
    subject,
    htmlContent,
    textContent,
    replyTo: replyTo ? (typeof replyTo === 'string' ? { email: replyTo } : replyTo) : undefined,
    attachment: attachments.length > 0
      ? attachments.map(({ name, content }) => ({ name, content: toBase64(content) }))
      : undefined
  });

  const apiInstance = getTransactionalApi();
  try {
    const response = await apiInstance.sendTransacEmail(email);
    return response;
  } catch (error) {
    const details = error?.response?.body || error;
    console.error('Brevo email send failed', details);
    throw new Error(
      details?.message ||
        details?.errors?.map((e) => e.message).join(', ') ||
        'Failed to send email via Brevo. Check API key, sender, and recipient details.'
    );
  }
};

const sendViaSmtp = async ({
  to,
  subject,
  htmlContent,
  textContent,
  attachments = [],
  replyTo
}) => {
  const senderEmail = process.env.EMAIL_FROM_ADDRESS;
  const senderName = process.env.EMAIL_FROM_NAME || 'Group Dues';
  const recipients = Array.isArray(to) ? to : [to];

  const transporter = getSmtpTransporter();

  const formattedAttachments =
    attachments.length > 0
      ? attachments.map(({ name, content }) => {
          if (Buffer.isBuffer(content)) {
            return { filename: name, content };
          }
          if (typeof content === 'string') {
            return { filename: name, content };
          }
          return { filename: name, content: Buffer.from(String(content)) };
        })
      : undefined;

  const info = await transporter.sendMail({
    from: senderName ? `"${senderName}" <${senderEmail}>` : senderEmail,
    to: recipients.join(','),
    subject,
    html: htmlContent,
    text: textContent,
    replyTo,
    attachments: formattedAttachments
  });

  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
};

export const sendEmail = async (args) => {
  if (process.env.EMAIL_ENABLED === 'false') {
    return { skipped: true };
  }

  const senderEmail = process.env.EMAIL_FROM_ADDRESS;
  if (!senderEmail) {
    throw new Error('EMAIL_FROM_ADDRESS is not configured');
  }

  const transport = String(process.env.EMAIL_TRANSPORT || 'api').toLowerCase();
  if (transport === 'smtp') {
    return await sendViaSmtp(args);
  }
  return await sendViaApi(args);
};


