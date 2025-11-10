import mongoose from 'mongoose';

const subgroupSchema = new mongoose.Schema({
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

export default mongoose.model('Subgroup', subgroupSchema);


