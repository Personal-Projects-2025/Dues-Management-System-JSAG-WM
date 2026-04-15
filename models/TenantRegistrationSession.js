import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import { connectMasterDB } from '../config/db.js';

let masterConn = null;
let SessionModel = null;

const sessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    adminEmail: { type: String, lowercase: true, trim: true, default: '' },
    contactPhone: { type: String, trim: true, default: '' },
    emailOtpHash: { type: String, default: null },
    emailOtpExpires: { type: Date, default: null },
    emailVerifiedAt: { type: Date, default: null },
    phoneOtpHash: { type: String, default: null },
    phoneOtpExpires: { type: Date, default: null },
    phoneVerifiedAt: { type: Date, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    emailOtpAttempts: { type: Number, default: 0 },
    phoneOtpAttempts: { type: Number, default: 0 },
    lastEmailOtpSentAt: { type: Date, default: null },
    lastPhoneOtpSentAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

const initializeModel = async () => {
  if (SessionModel) return SessionModel;
  if (!masterConn) masterConn = await connectMasterDB();
  if (masterConn.models.TenantRegistrationSession) {
    SessionModel = masterConn.models.TenantRegistrationSession;
    return SessionModel;
  }
  SessionModel = masterConn.model('TenantRegistrationSession', sessionSchema);
  return SessionModel;
};

export const getTenantRegistrationSessionModel = async () => initializeModel();

export function generateSessionId() {
  return randomBytes(24).toString('hex');
}
