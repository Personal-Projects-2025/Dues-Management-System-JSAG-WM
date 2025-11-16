// mail.js
import SibApiV3Sdk from "sib-api-v3-sdk";
import nodemailer from "nodemailer";

/* ------------------------------
   ENV HELPERS - ALWAYS CLEAN
---------------------------------*/
const cleanEnv = (value) => {
  if (!value) return "";
  return value.trim().replace(/^['"]|['"]$/g, "");
};

const EMAIL_FROM = cleanEnv(process.env.EMAIL_FROM_ADDRESS);
const EMAIL_NAME = cleanEnv(process.env.EMAIL_FROM_NAME || "Group Dues");
const BREVO_KEY = cleanEnv(process.env.BREVO_API_KEY);
const BREVO_SENDER_ID = cleanEnv(process.env.BREVO_SENDER_ID || "");
const EMAIL_TRANSPORT = cleanEnv(process.env.EMAIL_TRANSPORT || "api").toLowerCase();
const EMAIL_ENABLED = cleanEnv(process.env.EMAIL_ENABLED || "true") === "true";

/* ------------------------------
   VALIDATION
---------------------------------*/
if (!EMAIL_FROM || !EMAIL_FROM.includes("@")) {
  throw new Error("EMAIL_FROM_ADDRESS is missing or invalid");
}

if (!BREVO_KEY) {
  console.warn("⚠ BREVO_API_KEY missing — API emails will fail");
}

/* ------------------------------
   BREVO API SETUP
---------------------------------*/
const brevoClient = SibApiV3Sdk.ApiClient.instance;
brevoClient.authentications["api-key"].apiKey = BREVO_KEY;

const brevoApi = new SibApiV3Sdk.TransactionalEmailsApi();

/* ------------------------------
   BREVO API SENDER BUILDER
---------------------------------*/
const buildBrevoSender = () => {
  return {
    sender: {
      email: EMAIL_FROM,
      name: EMAIL_NAME,
    },
    ...(BREVO_SENDER_ID ? { senderId: Number(BREVO_SENDER_ID) } : {}),
  };
};

/* ------------------------------
   SEND VIA BREVO API
---------------------------------*/
export const sendViaBrevoApi = async ({
  to,
  subject,
  html,
  text,
  attachments = [],
  replyTo,
}) => {
  const recipients = Array.isArray(to)
    ? to.map((e) => ({ email: e }))
    : [{ email: to }];

  const payload = {
    ...buildBrevoSender(),
    to: recipients,
    subject,
    htmlContent: html,
    textContent: text,
    replyTo: replyTo ? { email: replyTo } : undefined,
    attachment:
      attachments.length > 0
        ? attachments.map(({ name, content }) => ({
            name,
            content: Buffer.from(content).toString("base64"),
          }))
        : undefined,
  };

  try {
    const result = await brevoApi.sendTransacEmail(payload);
    return { ok: true, brevo: true, result };
  } catch (err) {
    console.error("🔥 Brevo API send failed:", err?.response?.body || err);
    throw new Error(
      err?.response?.body?.message || err.message || "Failed to send email"
    );
  }
};

/* ------------------------------
   SMTP (Optional Fallback)
---------------------------------*/
let smtpTransporter;

const getSmtpTransporter = () => {
  if (smtpTransporter) return smtpTransporter;

  const host = cleanEnv(process.env.SMTP_HOST);
  const user = cleanEnv(process.env.SMTP_USER);
  const pass = cleanEnv(process.env.SMTP_PASS || process.env.SMTP_PASSWORD);
  const port = Number(cleanEnv(process.env.SMTP_PORT) || 587);

  if (!host || !user || !pass) {
    throw new Error("SMTP is not properly configured.");
  }

  smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { minVersion: "TLSv1.2" },
  });

  return smtpTransporter;
};

/* ------------------------------
   SEND VIA SMTP (Fallback)
---------------------------------*/
export const sendViaSmtp = async ({
  to,
  subject,
  html,
  text,
  attachments = [],
  replyTo,
}) => {
  const transporter = getSmtpTransporter();

  const info = await transporter.sendMail({
    from: `"${EMAIL_NAME}" <${EMAIL_FROM}>`,
    to: Array.isArray(to) ? to.join(",") : to,
    subject,
    html,
    text,
    replyTo,
    attachments,
  });

  return { ok: true, smtp: true, info };
};

/* ------------------------------
   MASTER EXPORT
---------------------------------*/
export const sendEmail = async (options) => {
  if (!EMAIL_ENABLED) {
    return { ok: true, skipped: true };
  }

  // Primary: Brevo API
  if (EMAIL_TRANSPORT === "api") {
    try {
      return await sendViaBrevoApi(options);
    } catch (error) {
      console.warn("⚠ API failed; trying SMTP fallback...");
      return await sendViaSmtp(options);
    }
  }

  // Primary: SMTP
  if (EMAIL_TRANSPORT === "smtp") {
    try {
      return await sendViaSmtp(options);
    } catch (error) {
      console.warn("⚠ SMTP failed; trying Brevo API fallback...");
      return await sendViaBrevoApi(options);
    }
  }

  throw new Error("Invalid EMAIL_TRANSPORT value.");
};
