import mongoose from 'mongoose';
import { connectMasterDB } from '../config/db.js';

// Get master connection
let masterConn = null;
const getMasterConnection = async () => {
  if (!masterConn) {
    masterConn = await connectMasterDB();
  }
  return masterConn;
};

const tenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens']
  },
  databaseName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9_-]+$/, 'Database name can only contain lowercase letters, numbers, underscores, and hyphens']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  config: {
    branding: {
      name: String,
      logo: String,
      primaryColor: { type: String, default: '#3B82F6' },
      secondaryColor: { type: String, default: '#1E40AF' }
    },
    settings: {
      emailNotifications: { type: Boolean, default: true },
      autoReceipts: { type: Boolean, default: true },
      reminderEnabled: { type: Boolean, default: true }
    },
    features: {
      subgroups: { type: Boolean, default: true },
      expenditure: { type: Boolean, default: true },
      reports: { type: Boolean, default: true }
    }
  },
  contact: {
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: String,
    address: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Soft delete support
tenantSchema.methods.softDelete = async function() {
  this.status = 'archived';
  this.deletedAt = new Date();
  await this.save();
};

tenantSchema.methods.restore = async function() {
  this.status = 'active';
  this.deletedAt = null;
  await this.save();
};

// Indexes
tenantSchema.index({ slug: 1 });
tenantSchema.index({ databaseName: 1 });
tenantSchema.index({ status: 1 });
tenantSchema.index({ deletedAt: 1 });

// Cache for model
let TenantModel = null;

// Initialize model with master connection
const initializeTenantModel = async () => {
  if (TenantModel) {
    return TenantModel;
  }

  const conn = await getMasterConnection();
  
  // Check if model already exists on connection
  if (conn.models.Tenant) {
    TenantModel = conn.models.Tenant;
    return TenantModel;
  }

  // Create model on master connection
  TenantModel = conn.model('Tenant', tenantSchema);
  return TenantModel;
};

// Get Tenant model (async)
export const getTenantModel = async () => {
  return await initializeTenantModel();
};

// Default export
export default async () => {
  return await getTenantModel();
};

