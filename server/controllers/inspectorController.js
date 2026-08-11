const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const Activity = require('../models/Activity');
const User = require('../models/User');

/**
 * @desc Get all listed groups across the application platform for Inspector audit
 * @route GET /api/inspector/groups
 */
const getAllGroupsForInspector = async (req, res) => {
  try {
    const groups = await Group.find()
      .populate('createdBy', 'fullName email phone')
      .sort({ createdAt: -1 });

    const groupSummaries = await Promise.all(
      groups.map(async (grp) => {
        const members = await GroupMember.find({ groupId: grp._id }).populate(
          'userId',
          'fullName email phone upiId qrCodeUrl'
        );

        const memberList = members
          .map((m) => m.userId)
          .filter(Boolean);

        const expenses = await Expense.find({ groupId: grp._id }).select('amount date paymentMode');
        const settlements = await Settlement.find({ groupId: grp._id }).select('amount status');

        const totalExpenseAmount = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
        const completedSettlementAmount = settlements
          .filter((s) => s.status === 'completed')
          .reduce((acc, curr) => acc + (curr.amount || 0), 0);

        return {
          _id: grp._id,
          name: grp.name,
          inviteCode: grp.inviteCode,
          createdBy: grp.createdBy,
          createdAt: grp.createdAt,
          memberCount: memberList.length,
          members: memberList,
          expenseCount: expenses.length,
          totalExpenseSum: totalExpenseAmount,
          settlementCount: settlements.length,
          completedSettlementSum: completedSettlementAmount,
        };
      })
    );

    return res.json({
      groups: groupSummaries,
      totalGroups: groupSummaries.length,
    });
  } catch (err) {
    console.error('[Inspector getAllGroups Error]:', err);
    return res.status(500).json({ message: 'Failed to fetch groups for inspection' });
  }
};

/**
 * @desc Get full person-wise, group-wise expense and settlement history for a specific group
 * @route GET /api/inspector/groups/:groupId
 */
const getGroupDetailsForInspector = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId).populate('createdBy', 'fullName email phone');
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const memberRecords = await GroupMember.find({ groupId }).populate(
      'userId',
      'fullName email phone upiId qrCodeUrl'
    );

    const members = memberRecords.map((m) => m.userId).filter(Boolean);
    const memberMap = new Map();
    members.forEach((m) => memberMap.set(m._id.toString(), m));

    // Fetch all expenses with populated paidBy & splitDetails
    const expenses = await Expense.find({ groupId })
      .populate('paidBy', 'fullName email phone')
      .populate('splitDetails.user', 'fullName email phone')
      .sort({ date: -1, createdAt: -1 });

    // Fetch all settlements
    const settlements = await Settlement.find({ groupId })
      .populate('payer', 'fullName email phone upiId')
      .populate('receiver', 'fullName email phone upiId')
      .sort({ createdAt: -1 });

    // Fetch activities
    const activities = await Activity.find({ groupId })
      .populate('user', 'fullName email')
      .sort({ timestamp: -1 })
      .limit(100);

    // Calculate Person-wise Breakdown:
    // For each member:
    // - paidTotal: amount paid by this member
    // - shareTotal: amount this member is responsible for across all expenses
    // - netBalance: paidTotal - shareTotal
    // - expenseList: array of expenses involving this member
    const personWiseBreakdown = members.map((member) => {
      const mId = member._id.toString();
      let paidTotal = 0;
      let shareTotal = 0;
      const memberExpenses = [];

      expenses.forEach((exp) => {
        const paidById = exp.paidBy?._id ? exp.paidBy._id.toString() : exp.paidBy?.toString();
        const isPayer = paidById === mId;

        // Calculate share for this member in this expense
        let memberShare = 0;
        let isIncludedInSplit = false;

        if (exp.splitType === 'everyone') {
          isIncludedInSplit = true;
          memberShare = exp.amount / (members.length || 1);
        } else if (exp.splitDetails && exp.splitDetails.length > 0) {
          const splitObj = exp.splitDetails.find(
            (s) => (s.user?._id ? s.user._id.toString() : s.user?.toString()) === mId
          );
          if (splitObj) {
            isIncludedInSplit = true;
            memberShare = splitObj.amount || 0;
          }
        }

        if (isPayer) {
          paidTotal += exp.amount;
        }
        shareTotal += memberShare;

        if (isPayer || isIncludedInSplit) {
          memberExpenses.push({
            expenseId: exp._id,
            title: exp.title,
            amount: exp.amount,
            date: exp.date || exp.createdAt,
            paymentMode: exp.paymentMode,
            role: isPayer && isIncludedInSplit ? 'Paid & Split' : isPayer ? 'Paid' : 'Share Owed',
            memberShare: Math.round(memberShare * 100) / 100,
          });
        }
      });

      return {
        member: {
          _id: member._id,
          fullName: member.fullName,
          email: member.email,
          phone: member.phone,
          upiId: member.upiId,
        },
        paidTotal: Math.round(paidTotal * 100) / 100,
        shareTotal: Math.round(shareTotal * 100) / 100,
        netBalance: Math.round((paidTotal - shareTotal) * 100) / 100,
        expenseCount: memberExpenses.length,
        expenses: memberExpenses,
      };
    });

    return res.json({
      group,
      memberCount: members.length,
      members,
      expenses,
      settlements,
      activities,
      personWiseBreakdown,
      totalGroupExpenses: expenses.reduce((acc, e) => acc + (e.amount || 0), 0),
    });
  } catch (err) {
    console.error('[Inspector getGroupDetails Error]:', err);
    return res.status(500).json({ message: 'Failed to fetch group details for inspection' });
  }
};

/**
 * @desc Get global platform metrics and aggregation analytics for Inspector audit
 * @route GET /api/inspector/analytics
 */
const getGlobalAnalyticsForInspector = async (req, res) => {
  try {
    // 1. Expense stats and payment mode breakdown pipeline
    const expenseAnalyticsPipeline = [
      {
        $group: {
          _id: null,
          totalExpenseVolume: { $sum: '$amount' },
          totalExpenseCount: { $sum: 1 },
          avgExpenseAmount: { $avg: '$amount' },
          cashVolume: {
            $sum: { $cond: [{ $eq: ['$paymentMode', 'cash'] }, '$amount', 0] },
          },
          cashCount: {
            $sum: { $cond: [{ $eq: ['$paymentMode', 'cash'] }, 1, 0] },
          },
          upiVolume: {
            $sum: { $cond: [{ $eq: ['$paymentMode', 'upi'] }, '$amount', 0] },
          },
          upiCount: {
            $sum: { $cond: [{ $eq: ['$paymentMode', 'upi'] }, 1, 0] },
          },
        },
      },
    ];

    // 2. Top Spenders Leaderboard pipeline
    const topSpendersPipeline = [
      {
        $group: {
          _id: '$paidBy',
          totalPaid: { $sum: '$amount' },
          expenseCount: { $sum: 1 },
        },
      },
      { $sort: { totalPaid: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      { $unwind: '$userInfo' },
      {
        $project: {
          _id: 1,
          totalPaid: 1,
          expenseCount: 1,
          fullName: '$userInfo.fullName',
          email: '$userInfo.email',
          phone: '$userInfo.phone',
        },
      },
    ];

    // 3. Settlement status breakdown pipeline
    const settlementAnalyticsPipeline = [
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ];

    const [expenseStatsRes, topSpenders, settlementStatsRes, totalGroups, totalUsers] = await Promise.all([
      Expense.aggregate(expenseAnalyticsPipeline),
      Expense.aggregate(topSpendersPipeline),
      Settlement.aggregate(settlementAnalyticsPipeline),
      Group.countDocuments(),
      User.countDocuments(),
    ]);

    const expenseStats = expenseStatsRes[0] || {
      totalExpenseVolume: 0,
      totalExpenseCount: 0,
      avgExpenseAmount: 0,
      cashVolume: 0,
      cashCount: 0,
      upiVolume: 0,
      upiCount: 0,
    };

    const settlementStats = {
      completedVolume: 0,
      completedCount: 0,
      pendingVolume: 0,
      pendingCount: 0,
      rejectedVolume: 0,
      rejectedCount: 0,
    };

    settlementStatsRes.forEach((item) => {
      if (item._id === 'completed') {
        settlementStats.completedVolume = item.totalAmount;
        settlementStats.completedCount = item.count;
      } else if (item._id === 'pending') {
        settlementStats.pendingVolume = item.totalAmount;
        settlementStats.pendingCount = item.count;
      } else if (item._id === 'rejected') {
        settlementStats.rejectedVolume = item.totalAmount;
        settlementStats.rejectedCount = item.count;
      }
    });

    return res.json({
      summary: {
        totalGroups,
        totalUsers,
        totalExpenseVolume: Math.round(expenseStats.totalExpenseVolume * 100) / 100,
        totalExpenseCount: expenseStats.totalExpenseCount,
        avgExpenseAmount: Math.round(expenseStats.avgExpenseAmount * 100) / 100,
        cashVolume: Math.round(expenseStats.cashVolume * 100) / 100,
        cashCount: expenseStats.cashCount,
        upiVolume: Math.round(expenseStats.upiVolume * 100) / 100,
        upiCount: expenseStats.upiCount,
      },
      settlementStats,
      topSpenders,
    });
  } catch (err) {
    console.error('[Inspector getGlobalAnalytics Error]:', err);
    return res.status(500).json({ message: 'Failed to compute platform analytics' });
  }
};

module.exports = {
  getAllGroupsForInspector,
  getGroupDetailsForInspector,
  getGlobalAnalyticsForInspector,
};
