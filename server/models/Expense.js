const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Expense title is required'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Expense amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  splitType: {
    type: String,
    enum: ['everyone', 'specific'],
    default: 'everyone'
  },
  splitBetween: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  splitDetails: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    share: {
      type: Number,
      required: true
    }
  }],
  paymentMode: {
    type: String,
    enum: ['cash', 'upi'],
    default: 'cash'
  },
  screenshotUrl: {
    type: String,
    default: null
  },
  screenshotPublicId: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Reporting and listing always scope by group and order/filter by date.
expenseSchema.index({ groupId: 1, date: -1 });
// Supports payer-scoped analytics without a collection scan.
expenseSchema.index({ groupId: 1, paidBy: 1 });
// Supports participant-scoped lookups (multikey over the ObjectId array).
expenseSchema.index({ groupId: 1, splitBetween: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
