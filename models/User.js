import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { connectMasterDB } from '../config/db.js';

// Cache for master connection and model
let masterConn = null;
let UserModel = null;

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: false, // Optional for backward compatibility with existing users
    unique: true,
    sparse: true, // Allows multiple null values
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    default: null
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['system', 'super', 'admin'],
    required: true
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    default: null
  },
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const token = randomBytes(32).toString('hex');
  this.passwordResetToken = token;
  this.passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return token;
};

// Initialize model with master connection
const initializeUserModel = async () => {
  if (UserModel) {
    return UserModel;
  }

  if (!masterConn) {
    masterConn = await connectMasterDB();
  }

  // Check if model already exists on connection
  if (masterConn.models.User) {
    UserModel = masterConn.models.User;
    return UserModel;
  }

  // Create model on master connection
  UserModel = masterConn.model('User', userSchema);
  return UserModel;
};

// Get User model (async)
export const getUserModel = async () => {
  return await initializeUserModel();
};

// Default export - returns model after initialization
// For backward compatibility, we'll export a function that returns the model
export default async () => {
  return await getUserModel();
};

// Also export a synchronous getter (will initialize on first use)
// This is for code that needs immediate access
let modelPromise = null;
export const getModel = () => {
  if (!modelPromise) {
    modelPromise = initializeUserModel();
  }
  return modelPromise;
};

