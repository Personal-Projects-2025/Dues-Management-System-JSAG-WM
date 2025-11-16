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

let cachedSenderId = null;
const resolveBrevoSenderId = async (senderEmail) => {
  if (cachedSenderId) {
    return cachedSenderId;
  }
  try {
    const accountApi = new SibApiV3Sdk.SendersApi();
    const list = await accountApi.getSenders();
    const found = list?.senders?.find((s) => String(s.email).toLowerCase() === String(senderEmail).toLowerCase());
    if (found?.id) {
      cachedSenderId = Number(found.id);
      return cachedSenderId;
    }
  } catch (e) {
    // swallow; we'll fall back to explicit sender object
  }
  return null;
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
      auth: { user, pass },
      connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 15000),
      greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000),
      socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 20000),
      tls: {
        minVersion: 'TLSv1.2'
      }
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
  // Strip accidental wrapping quotes from env values
  const rawSenderEmail = (process.env.EMAIL_FROM_ADDRESS || '').trim();
  const senderEmail = rawSenderEmail.replace(/^['"]|['"]$/g, '');
  const senderName = (process.env.EMAIL_FROM_NAME || 'Group Dues').trim();
  if (!senderEmail || !senderEmail.includes('@')) {
    throw new Error('EMAIL_FROM_ADDRESS is missing or invalid');
  }
  let senderId = (process.env.BREVO_SENDER_ID || '2').trim();
  if (!senderId && String(process.env.AUTO_RESOLVE_BREVO_SENDER || 'true') !== 'false') {
    senderId = String(await resolveBrevoSenderId(senderEmail) || '');
  }
  const recipients = Array.isArray(to) ? to : [to];

  const emailPayload = {
    // Always include sender; add senderId as well if available
    sender: { email: senderEmail, name: senderName },
    ...(senderId ? { senderId: Number(senderId) } : {}),
    to: recipients.map((recipient) => (typeof recipient === 'string' ? { email: recipient } : recipient)),
    subject,
    htmlContent,
    textContent,
    replyTo: replyTo ? (typeof replyTo === 'string' ? { email: replyTo } : replyTo) : undefined,
    attachment: attachments.length > 0
      ? attachments.map(({ name, content }) => ({ name, content: toBase64(content) }))
      : undefined
  };

  const email = new SibApiV3Sdk.SendSmtpEmail(emailPayload);

  const apiInstance = getTransactionalApi();
  try {
    const response = await apiInstance.sendTransacEmail(email);
    return response;
  } catch (error) {
    const details = error?.response?.body || error;
    console.error('Brevo email send failed', {
      code: details?.code || error?.code,
      message: details?.message || error?.message,
      // Safe diagnostics for sender (no secrets)
      senderDiag: {
        usingSenderId: Boolean(senderId),
        senderId: senderId || null,
        senderEmail: senderId ? null : senderEmail || null
      }
    });
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
  const rawSenderEmail = (process.env.EMAIL_FROM_ADDRESS || '').trim();
  const senderEmail = rawSenderEmail.replace(/^['"]|['"]$/g, '');
  const senderName = (process.env.EMAIL_FROM_NAME || 'Group Dues').trim();
  if (!senderEmail || !senderEmail.includes('@')) {
    throw new Error('EMAIL_FROM_ADDRESS is missing or invalid');
  }
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
    try {
      return await sendViaSmtp(args);
    } catch (err) {
      if (canFallbackToApi(err) && String(process.env.EMAIL_FALLBACK || 'true') !== 'false') {
        console.warn('SMTP send failed, falling back to Brevo API:', err?.code || err?.message);
        return await sendViaApi(args);
      }
      throw err;
    }
  }
  return await sendViaApi(args);
};

const canFallbackToApi = (err) => {
  const code = err?.code;
  const transient = ['ETIMEDOUT', 'ECONNECTION', 'EAI_AGAIN', 'ENOTFOUND'];
  return transient.includes(code || '') && !!process.env.BREVO_API_KEY;
};


