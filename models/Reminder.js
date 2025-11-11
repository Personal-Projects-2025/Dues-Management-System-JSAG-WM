import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema(
  {
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
  },
  {
    timestamps: true
  }
);

export default mongoose.model('Reminder', reminderSchema);


