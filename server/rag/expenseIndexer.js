const { getPineconeIndex, getUserNamespace, isPineconeConfigured } = require('./pineconeClient');
const { generateEmbedding } = require('./embeddingService');
const Expense = require('../models/Expense');
const Group = require('../models/Group');

/**
 * Builds rich semantic representation of an expense for a specific user.
 */
const buildExpenseSemanticDoc = (expense, userName, userShare, groupName) => {
  const payerName = expense.paidBy?.fullName || 'Flatmate';
  const dateStr = expense.date ? new Date(expense.date).toISOString().split('T')[0] : 'Recent';
  const mode = expense.paymentMode === 'upi' ? 'UPI / Online' : 'Cash';
  const notes = expense.notes ? ` Notes: ${expense.notes}.` : '';

  return `Expense: ${expense.title}. Total Amount: ₹${expense.amount}. Paid by: ${payerName}. Date: ${dateStr}. Group: ${groupName}. ${userName}'s share: ₹${userShare}. Payment Mode: ${mode}.${notes}`;
};

/**
 * Asynchronously indexes an expense into Pinecone for all relevant participants.
 * Does not block HTTP responses.
 */
const indexExpenseAsync = async (expenseId) => {
  try {
    if (!isPineconeConfigured()) return;
    const index = getPineconeIndex();
    if (!index) return;

    // Hydrate populated expense
    const expense = await Expense.findById(expenseId)
      .populate('paidBy', 'fullName email')
      .populate('splitDetails.user', 'fullName email')
      .populate('groupId', 'name');

    if (!expense) return;

    const groupName = expense.groupId?.name || 'Flatmates';
    const payerId = (expense.paidBy?._id || expense.paidBy).toString();

    // Collect all users who participated in this expense
    const participantsMap = new Map();

    // 1. Payer
    if (expense.paidBy) {
      const payerShare = expense.splitDetails?.find(d => (d.user?._id || d.user)?.toString() === payerId)?.share || 0;
      participantsMap.set(payerId, {
        userId: payerId,
        userName: expense.paidBy.fullName || 'You',
        share: payerShare,
      });
    }

    // 2. Beneficiaries
    if (expense.splitDetails && expense.splitDetails.length > 0) {
      expense.splitDetails.forEach(detail => {
        const uId = (detail.user?._id || detail.user)?.toString();
        if (uId && !participantsMap.has(uId)) {
          participantsMap.set(uId, {
            userId: uId,
            userName: detail.user?.fullName || 'Flatmate',
            share: detail.share || 0,
          });
        }
      });
    }

    // Index for each participant in their own isolated namespace
    for (const [userId, participant] of participantsMap.entries()) {
      const semanticDoc = buildExpenseSemanticDoc(expense, participant.userName, participant.share, groupName);
      const vector = await generateEmbedding(semanticDoc);

      if (vector && vector.length > 0) {
        const namespace = getUserNamespace(userId);
        const recordId = `expense_${expense._id.toString()}`;

        await index.namespace(namespace).upsert([
          {
            id: recordId,
            values: vector,
            metadata: {
              expenseId: expense._id.toString(),
              userId: userId,
              groupId: (expense.groupId?._id || expense.groupId).toString(),
              paidByUserId: payerId,
              title: expense.title,
              amount: Number(expense.amount),
              userShare: Number(participant.share),
              paymentMode: expense.paymentMode || 'cash',
              splitType: expense.splitType || 'everyone',
              expenseDate: expense.date ? new Date(expense.date).toISOString() : new Date().toISOString(),
              createdAt: expense.createdAt ? new Date(expense.createdAt).toISOString() : new Date().toISOString(),
            },
          },
        ]);
      }
    }
  } catch (err) {
    console.warn(`[Pinecone Indexer Warning] Non-blocking indexing skipped for expense ${expenseId}:`, err.message);
  }
};

/**
 * Asynchronously removes an expense record from Pinecone across all participant namespaces.
 */
const deleteExpenseIndexAsync = async (expenseId, userIds = []) => {
  try {
    if (!isPineconeConfigured()) return;
    const index = getPineconeIndex();
    if (!index) return;

    const recordId = `expense_${expenseId.toString()}`;

    for (const userId of userIds) {
      if (!userId) continue;
      const namespace = getUserNamespace(userId);
      try {
        await index.namespace(namespace).deleteOne(recordId);
      } catch (delErr) {
        // Ignore single namespace deletion error
      }
    }
  } catch (err) {
    console.warn(`[Pinecone Indexer Warning] Non-blocking deletion skipped for expense ${expenseId}:`, err.message);
  }
};

/**
 * Reindexes all expenses for a specific group into Pinecone.
 */
const reindexGroupExpenses = async (groupId) => {
  try {
    const expenses = await Expense.find({ groupId }).select('_id');
    let count = 0;
    for (const exp of expenses) {
      await indexExpenseAsync(exp._id);
      count++;
    }
    return { success: true, count };
  } catch (err) {
    console.error(`[Pinecone Reindex Group Error]:`, err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Reindexes all expenses across all groups into Pinecone.
 */
const reindexAllExpenses = async () => {
  try {
    const expenses = await Expense.find({}).select('_id');
    console.log(`🌲 [Pinecone Reindex All] Starting reindex for ${expenses.length} total MongoDB expenses...`);
    let count = 0;
    for (const exp of expenses) {
      await indexExpenseAsync(exp._id);
      count++;
    }
    console.log(`🌲 [Pinecone Reindex All] Successfully reindexed ${count} expenses into Pinecone.`);
    return { success: true, count };
  } catch (err) {
    console.error('[Pinecone Reindex All Error]:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = {
  indexExpenseAsync,
  deleteExpenseIndexAsync,
  reindexAllExpenses,
};
