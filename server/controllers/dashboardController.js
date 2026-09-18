const GroupMember = require('../models/GroupMember');
const Group = require('../models/Group');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const Activity = require('../models/Activity');
const { calculateGroupBalances } = require('../utils/balance');
const { calculateBillingCycle } = require('../utils/billingCycle');

// @desc Get full aggregated Dashboard data
// @route GET /api/dashboard
const getDashboardData = async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();

    // Check group membership
    const membership = await GroupMember.findOne({ userId: currentUserId }).populate('groupId');
    if (!membership || !membership.groupId) {
      return res.json({
        hasGroup: false,
        user: req.user
      });
    }

    const group = membership.groupId;
    const groupId = group._id;

    // 1. Calculate dynamic group balances
    const balances = await calculateGroupBalances(groupId, currentUserId);

    // 2. Fetch pending verifications.
    // Uses the live Settlement status model ('paid_pending_approval'). The previous query
    // targeted the retired 'verification_pending' status plus an `expiresAt` field that no
    // longer exists on the schema, so it could never match and this section was always empty.
    const pendingSettlements = await Settlement.find({
      groupId,
      status: 'paid_pending_approval'
    })
    .sort({ createdAt: -1 })
    .populate('payer', 'fullName email phone upiId qrCodeUrl')
    .populate('receiver', 'fullName email phone upiId qrCodeUrl');

    const receiverPending = pendingSettlements.filter(s => s.receiver._id.toString() === currentUserId);
    const payerPending = pendingSettlements.filter(s => s.payer._id.toString() === currentUserId);

    // 3. Fetch Recent Expenses (latest 5)
    const recentExpenses = await Expense.find({ groupId })
      .sort({ date: -1 })
      .limit(5)
      .populate('paidBy', 'fullName email phone')
      .populate('splitDetails.user', 'fullName email phone');

    // 4. Fetch Recent Activity (latest 10)
    const recentActivity = await Activity.find({ groupId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'fullName email');

    return res.json({
      hasGroup: true,
      user: req.user,
      group: {
        _id: group._id,
        name: group.name,
        inviteCode: group.inviteCode,
        createdBy: group.createdBy,
        createdAt: group.createdAt,
        payday: group.payday ?? null,
        userRole: membership.role
      },
      // The client has always read `billingCycle` from this payload but the endpoint never
      // returned it, so the payday banner could not render. Derived here from the single
      // billing-cycle helper rather than being recomputed on the client.
      billingCycle: calculateBillingCycle(group.payday),
      balances: {
        youNeedToPayTotal: balances.currentUserSummary.youNeedToPayTotal,
        youNeedToPayList: balances.currentUserSummary.youNeedToPayList,
        youWillReceiveTotal: balances.currentUserSummary.youWillReceiveTotal,
        youWillReceiveList: balances.currentUserSummary.youWillReceiveList
      },
      pendingVerifications: {
        asReceiver: receiverPending,
        asPayer: payerPending
      },
      recentExpenses,
      recentActivity
    });
  } catch (error) {
    console.error('Get Dashboard Data Error:', error);
    return res.status(500).json({ message: 'Server error loading dashboard data' });
  }
};

module.exports = { getDashboardData };
