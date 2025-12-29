import mongoose from 'mongoose';

// Export all schemas for use with tenant connections

// Payment History Schema (embedded in Member)
export const paymentHistorySchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  monthsCovered: {
    type: Number,
    required: true
  },
  recordedBy: {
    type: String,
    required: true
  }
});

// Member Schema
export const memberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  memberId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  subgroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subgroup',
    default: null
  },
  contact: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email address']
  },
  role: {
    type: String,
    enum: ['member', 'admin'],
    default: 'member'
  },
  joinDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  duesPerMonth: {
    type: Number,
    required: true,
    min: 0
  },
  totalPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  monthsCovered: {
    type: Number,
    default: 0,
    min: 0
  },
  arrears: {
    type: Number,
    default: 0,
    min: 0
  },
  lastPaymentDate: {
    type: Date
  },
  paymentHistory: [paymentHistorySchema]
}, {
  timestamps: true
});

// Method to calculate arrears
memberSchema.methods.calculateArrears = function() {
  const now = new Date();
  const joinYear = this.joinDate.getFullYear();
  const joinMonth = this.joinDate.getMonth();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  const totalMonthsSinceJoin = (currentYear - joinYear) * 12 + (currentMonth - joinMonth) + 1;
  const arrears = Math.max(0, totalMonthsSinceJoin - this.monthsCovered);
  
  return arrears;
};

// Subgroup Schema
export const subgroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  leaderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Expenditure Schema
export const expenditureSchema = new mongoose.Schema({
  expenseId: {
    type: String,
    unique: true,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  spentBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Receipt Schema
export const receiptSchema = new mongoose.Schema({
  receiptId: {
    type: String,
    unique: true,
    required: true
  },
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true
  },
  memberName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  duesPerMonth: {
    type: Number,
    required: true
  },
  monthsCovered: {
    type: Number,
    required: true
  },
  paymentDate: {
    type: Date,
    required: true
  },
  recordedBy: {
    type: String,
    required: true
  },
  recordedAt: {
    type: Date,
    default: Date.now
  },
  remarks: {
    type: String,
    default: ''
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  }
}, {
  timestamps: true
});

// Reminder Schema
export const reminderSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  amountOwed: {
    type: Number,
    required: true
  },
  monthsInArrears: {
    type: Number,
    required: true
  },
  scriptureRef: {
    type: String
  },
  scriptureText: {
    type: String
  },
  status: {
    type: String,
    enum: ['sent', 'failed'],
    required: true
  },
  error: {
    type: String
  },
  triggeredBy: {
    type: String,
    enum: ['system', 'manual'],
    default: 'system'
  },
  sentAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Activity Log Schema
export const activityLogSchema = new mongoose.Schema({
  actor: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['system', 'super', 'admin'],
    required: true
  },
  action: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  affectedMember: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

