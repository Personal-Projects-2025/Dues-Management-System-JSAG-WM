import mongoose from 'mongoose';
import { connectMasterDB } from '../config/db.js';

let masterConn = null;
let Model = null;

const schema = new mongoose.Schema(
  {
    databaseName: { type: String, required: true, index: true },
    receiptId: { type: String, required: true },
    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    accessCount: { type: Number, default: 0 },
    lastAccessAt: { type: Date, default: null }
  },
  { timestamps: true }
);

schema.index({ databaseName: 1, receiptId: 1 }, { unique: true });

async function init() {
  if (Model) return Model;
  if (!masterConn) masterConn = await connectMasterDB();
  if (masterConn.models.ReceiptPublicLink) {
    Model = masterConn.models.ReceiptPublicLink;
    return Model;
  }
  Model = masterConn.model('ReceiptPublicLink', schema);
  return Model;
}

export const getReceiptPublicLinkModel = () => init();
