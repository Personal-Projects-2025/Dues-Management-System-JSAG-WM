import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  actor: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['super', 'admin'],
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

export default mongoose.model('ActivityLog', activityLogSchema);

