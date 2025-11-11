import SibApiV3Sdk from 'sib-api-v3-sdk';

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

export const sendEmail = async ({
  to,
  subject,
  htmlContent,
  textContent,
  attachments = [],
  replyTo
}) => {
  if (process.env.EMAIL_ENABLED === 'false') {
    return { skipped: true };
  }

  const senderEmail = process.env.EMAIL_FROM_ADDRESS;
  if (!senderEmail) {
    throw new Error('EMAIL_FROM_ADDRESS is not configured');
  }

  const senderName = process.env.EMAIL_FROM_NAME || 'Group Dues';
  const recipients = Array.isArray(to) ? to : [to];

  const email = new SibApiV3Sdk.SendSmtpEmail({
    sender: {
      email: senderEmail,
      name: senderName
    },
    to: recipients.map((recipient) =>
      typeof recipient === 'string' ? { email: recipient } : recipient
    ),
    subject,
    htmlContent,
    textContent,
    replyTo: replyTo
      ? typeof replyTo === 'string'
        ? { email: replyTo }
        : replyTo
      : undefined,
    attachment:
      attachments.length > 0
        ? attachments.map(({ name, content }) => ({
            name,
            content: toBase64(content)
          }))
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


