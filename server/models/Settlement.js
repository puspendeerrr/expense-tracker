const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  payer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Settlement amount must be greater than 0']
  },
  status: {
    type: String,
    enum: ['completed', 'paid_pending_approval', 'will_pay_soon', 'rejected', 'cancelled'],
    default: 'completed'
  },
  paymentMethod: {
    type: String,
    enum: ['upi', 'cash'],
    default: 'upi'
  },
  proofUrl: {
    type: String,
    default: null
  },
  proofPublicId: {
    type: String,
    default: null
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  note: {
    type: String,
    default: ''
  },
  paidAt: {
    type: Date,
    default: Date.now
  },
  verifiedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// History listing: newest-first within a group.
settlementSchema.index({ groupId: 1, createdAt: -1 });
// Balance engine reads only completed settlements; attention centre filters by status.
settlementSchema.index({ groupId: 1, status: 1 });
// Attention centre resolves the current user's own settlements on either side.
settlementSchema.index({ payer: 1, status: 1 });
settlementSchema.index({ receiver: 1, status: 1 });

module.exports = mongoose.model('Settlement', settlementSchema);
