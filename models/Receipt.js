import mongoose from 'mongoose';

const receiptSchema = new mongoose.Schema({
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

export default mongoose.model('Receipt', receiptSchema);

