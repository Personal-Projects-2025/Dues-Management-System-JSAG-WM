import { randomBytes } from 'crypto';
import { getReceiptPublicLinkModel } from '../models/ReceiptPublicLink.js';

const DEFAULT_TTL_DAYS = parseInt(process.env.RECEIPT_PREVIEW_TTL_DAYS || '90', 10) || 90;

/**
 * Ensure a stable public preview token for this receipt; extends expiry on each call.
 * Mongo master DB only (no-op if unavailable).
 */
export async function upsertReceiptPublicLink(databaseName, receiptId) {
  if (!databaseName || !receiptId) return null;
  try {
    const ReceiptPublicLink = await getReceiptPublicLinkModel();
    const expiresAt = new Date(Date.now() + DEFAULT_TTL_DAYS * 86400000);

    let doc = await ReceiptPublicLink.findOne({ databaseName, receiptId });
    if (doc) {
      doc.expiresAt = expiresAt;
      await doc.save();
      return doc.token;
    }

    const token = randomBytes(32).toString('hex');
    doc = await ReceiptPublicLink.create({
      databaseName,
      receiptId,
      token,
      expiresAt,
      accessCount: 0
    });
    return doc.token;
  } catch (e) {
    console.error('upsertReceiptPublicLink', e.message);
    return null;
  }
}

/**
 * Base URL for links placed in SMS (no trailing slash).
 * Prefer RECEIPT_PREVIEW_PUBLIC_URL, then API_PUBLIC_URL, then localhost.
 */
export function getReceiptPreviewPublicBaseUrl() {
  const explicit =
    process.env.RECEIPT_PREVIEW_PUBLIC_URL?.trim() ||
    process.env.API_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
}

export function buildReceiptPreviewPdfUrl(token) {
  if (!token) return null;
  const base = getReceiptPreviewPublicBaseUrl();
  return `${base}/api/public/receipt/${encodeURIComponent(token)}/pdf`;
}

/**
 * URL embedded in SMS: direct PDF by default, or shorter `/r/:token` on the frontend when enabled.
 */
export function buildReceiptPreviewUrlForSms(token) {
  if (!token) return null;
  const useFrontend =
    process.env.RECEIPT_SMS_USE_FRONTEND_LINK === 'true' && process.env.FRONTEND_URL?.trim();
  if (useFrontend) {
    return `${process.env.FRONTEND_URL.trim().replace(/\/$/, '')}/r/${encodeURIComponent(token)}`;
  }
  return buildReceiptPreviewPdfUrl(token);
}
