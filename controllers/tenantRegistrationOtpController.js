import bcrypt from 'bcrypt';
import { getTenantRegistrationSessionModel, generateSessionId } from '../models/TenantRegistrationSession.js';
import { normalizeGhanaPhone } from '../utils/smsNotifyGh.js';
import { sendSms } from '../utils/smsNotifyGh.js';
import { smsOtpPhone } from '../utils/smsTemplates.js';
import { sendEmail } from '../utils/mailer.js';

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const OTP_TTL_MS = 15 * 60 * 1000;
const RESEND_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 8;

function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getSession() {
  return getTenantRegistrationSessionModel();
}

export const createRegistrationSession = async (req, res) => {
  try {
    const Session = await getSession();
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await Session.create({ sessionId, expiresAt });
    res.status(201).json({ sessionId, expiresAt: expiresAt.toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const sendRegistrationEmailOtp = async (req, res) => {
  try {
    const { sessionId, adminEmail } = req.body;
    if (!sessionId || !adminEmail || !/^\S+@\S+\.\S+$/.test(adminEmail)) {
      return res.status(400).json({ error: 'sessionId and valid adminEmail are required' });
    }
    const Session = await getSession();
    const session = await Session.findOne({ sessionId, expiresAt: { $gt: new Date() } });
    if (!session) {
      return res.status(400).json({ error: 'Invalid or expired registration session' });
    }
    if (session.lastEmailOtpSentAt && Date.now() - session.lastEmailOtpSentAt.getTime() < RESEND_MS) {
      return res.status(429).json({ error: 'Please wait before requesting another email code' });
    }

    const otp = genOtp();
    const emailOtpHash = await bcrypt.hash(otp, 10);
    session.adminEmail = adminEmail.toLowerCase().trim();
    session.emailOtpHash = emailOtpHash;
    session.emailOtpExpires = new Date(Date.now() + OTP_TTL_MS);
    session.lastEmailOtpSentAt = new Date();
    await session.save();

    await sendEmail({
      to: session.adminEmail,
      subject: 'Your registration verification code',
      html: `<p>Your verification code is <strong>${otp}</strong>.</p><p>This code expires in 15 minutes. Do not share it.</p>`,
      text: `Your verification code is ${otp}. Expires in 15 minutes. Do not share it.`
    });

    res.json({ message: 'Verification code sent to your email' });
  } catch (e) {
    console.error('sendRegistrationEmailOtp', e);
    res.status(500).json({ error: e.message });
  }
};

export const verifyRegistrationEmailOtp = async (req, res) => {
  try {
    const { sessionId, adminEmail, otp } = req.body;
    if (!sessionId || !adminEmail || !otp) {
      return res.status(400).json({ error: 'sessionId, adminEmail, and otp are required' });
    }
    const Session = await getSession();
    const session = await Session.findOne({ sessionId, expiresAt: { $gt: new Date() } });
    if (!session || !session.emailOtpHash) {
      return res.status(400).json({ error: 'Invalid or expired registration session' });
    }
    if (session.adminEmail !== adminEmail.toLowerCase().trim()) {
      return res.status(400).json({ error: 'Email does not match' });
    }
    if (session.emailOtpExpires && new Date() > session.emailOtpExpires) {
      return res.status(400).json({ error: 'Code expired. Request a new one.' });
    }
    if ((session.emailOtpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      return res.status(400).json({ error: 'Too many attempts. Start a new registration session.' });
    }
    const ok = await bcrypt.compare(String(otp).trim(), session.emailOtpHash);
    if (!ok) {
      session.emailOtpAttempts = (session.emailOtpAttempts || 0) + 1;
      await session.save();
      if (session.emailOtpAttempts >= MAX_OTP_ATTEMPTS) {
        return res.status(400).json({ error: 'Too many attempts. Start a new registration session.' });
      }
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    session.emailVerifiedAt = new Date();
    session.emailOtpHash = null;
    session.emailOtpExpires = null;
    await session.save();

    res.json({ message: 'Email verified' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const sendRegistrationPhoneOtp = async (req, res) => {
  try {
    const { sessionId, contactPhone } = req.body;
    if (!sessionId || !contactPhone) {
      return res.status(400).json({ error: 'sessionId and contactPhone are required' });
    }
    const normalized = normalizeGhanaPhone(contactPhone);
    if (!normalized) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }
    const Session = await getSession();
    const session = await Session.findOne({ sessionId, expiresAt: { $gt: new Date() } });
    if (!session) {
      return res.status(400).json({ error: 'Invalid or expired registration session' });
    }
    if (!session.emailVerifiedAt) {
      return res.status(400).json({ error: 'Verify your email first' });
    }
    if (session.lastPhoneOtpSentAt && Date.now() - session.lastPhoneOtpSentAt.getTime() < RESEND_MS) {
      return res.status(429).json({ error: 'Please wait before requesting another SMS code' });
    }

    const otp = genOtp();
    const phoneOtpHash = await bcrypt.hash(otp, 10);
    session.contactPhone = normalized;
    session.phoneOtpHash = phoneOtpHash;
    session.phoneOtpExpires = new Date(Date.now() + OTP_TTL_MS);
    session.lastPhoneOtpSentAt = new Date();
    await session.save();

    const smsResult = await sendSms({
      to: normalized,
      message: smsOtpPhone({ code: otp, context: 'phone verification' })
    });
    if (!smsResult.ok && !smsResult.skipped) {
      return res.status(502).json({
        error: 'Failed to send SMS',
        code: smsResult.code,
        detail: smsResult.raw
      });
    }

    res.json({ message: 'Verification code sent to your phone' });
  } catch (e) {
    console.error('sendRegistrationPhoneOtp', e);
    res.status(500).json({ error: e.message });
  }
};

export const verifyRegistrationPhoneOtp = async (req, res) => {
  try {
    const { sessionId, contactPhone, otp } = req.body;
    if (!sessionId || !contactPhone || !otp) {
      return res.status(400).json({ error: 'sessionId, contactPhone, and otp are required' });
    }
    const normalized = normalizeGhanaPhone(contactPhone);
    if (!normalized) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }
    const Session = await getSession();
    const session = await Session.findOne({ sessionId, expiresAt: { $gt: new Date() } });
    if (!session || !session.phoneOtpHash) {
      return res.status(400).json({ error: 'Invalid or expired registration session' });
    }
    if (session.contactPhone !== normalized) {
      return res.status(400).json({ error: 'Phone number does not match' });
    }
    if (session.phoneOtpExpires && new Date() > session.phoneOtpExpires) {
      return res.status(400).json({ error: 'Code expired. Request a new one.' });
    }
    if ((session.phoneOtpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      return res.status(400).json({ error: 'Too many attempts. Start a new registration session.' });
    }
    const ok = await bcrypt.compare(String(otp).trim(), session.phoneOtpHash);
    if (!ok) {
      session.phoneOtpAttempts = (session.phoneOtpAttempts || 0) + 1;
      await session.save();
      if (session.phoneOtpAttempts >= MAX_OTP_ATTEMPTS) {
        return res.status(400).json({ error: 'Too many attempts. Start a new registration session.' });
      }
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    session.phoneVerifiedAt = new Date();
    session.phoneOtpHash = null;
    session.phoneOtpExpires = null;
    await session.save();

    res.json({ message: 'Phone verified' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Validates session for finalize; returns { ok, error } without deleting session (caller deletes on success).
 */
export async function validateRegistrationSessionForFinalize(body) {
  const { sessionId, adminEmail, contactPhone } = body;
  if (!sessionId) {
    return { ok: false, error: 'sessionId is required. Complete email and phone verification first.' };
  }
  const Session = await getSession();
  const session = await Session.findOne({ sessionId, expiresAt: { $gt: new Date() } });
  if (!session || !session.emailVerifiedAt || !session.phoneVerifiedAt) {
    return { ok: false, error: 'Invalid session or email/phone not verified' };
  }
  const em = (adminEmail || '').toLowerCase().trim();
  if (!em || !session.adminEmail || session.adminEmail !== em) {
    return { ok: false, error: 'Admin email must match the verified email' };
  }
  const normalized = normalizeGhanaPhone(contactPhone);
  if (!normalized || session.contactPhone !== normalized) {
    return { ok: false, error: 'Contact phone must match the verified phone number' };
  }
  return { ok: true, session };
}
