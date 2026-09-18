/**
 * Reporting & Excel Export — integration + reconciliation tests.
 *
 * Runs against a real MongoDB using a disposable database, because the whole point of these
 * tests is to prove that the reporting layer reconciles with the live balance engine.
 *
 *   node tests/reporting.test.js
 *
 * Override the target with MONGODB_TEST_URI. Defaults to a throwaway local database, which is
 * dropped at the start and end of the run.
 */

const assert = require('assert');
const path = require('path');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const TEST_URI =
  process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/expense_tracker_reporting_test';

const User = require('../models/User');
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');

const {
  parseReportFilters,
  buildReport,
  buildExportDataset,
  bucketFor,
  resolveGrouping,
  matchesInvolvement,
} = require('../services/reportingService');
const { generateFinancialReport } = require('../services/excelExportService');
const { calculateGroupBalances } = require('../utils/balance');

let passed = 0;
let failed = 0;

const check = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}\n     ${err.message}`);
  }
};

/** Compare money to the paise, to catch float drift rather than hide it. */
const eqMoney = (actual, expected, label) => {
  const a = Math.round(actual * 100);
  const e = Math.round(expected * 100);
  assert.strictEqual(a, e, `${label}: expected ₹${expected} but got ₹${actual}`);
};

const sum = (arr, key) => Math.round(arr.reduce((acc, x) => acc + x[key] * 100, 0)) / 100;

// Fixed reference instants so the test is deterministic.
const D = (iso) => new Date(iso);

let alice, bob, carol, dave, group;

const seed = async () => {
  await mongoose.connection.dropDatabase();

  [alice, bob, carol, dave] = await User.create([
    { fullName: 'Alice O\'Brien', email: 'alice@test.local', phone: '1', password: 'x'.repeat(60), upiId: 'alice@upi' },
    { fullName: 'Bob =SUM(A1)', email: 'bob@test.local', phone: '2', password: 'x'.repeat(60), upiId: 'bob@upi' },
    { fullName: 'Carol ₹ Näme', email: 'carol@test.local', phone: '3', password: 'x'.repeat(60) },
    { fullName: 'Dave Lonely', email: 'dave@test.local', phone: '4', password: 'x'.repeat(60) },
  ]);

  group = await Group.create({
    name: 'Flat 304',
    inviteCode: 'TEST01',
    inviteToken: 'tok-reporting-test',
    createdBy: alice._id,
    payday: 5,
  });

  await GroupMember.create([
    { groupId: group._id, userId: alice._id, role: 'creator' },
    { groupId: group._id, userId: bob._id, role: 'member' },
    { groupId: group._id, userId: carol._id, role: 'member' },
    { groupId: group._id, userId: dave._id, role: 'member' },
  ]);

  // --- Expenses ---------------------------------------------------------
  // E1: Alice pays 900, split equally 4 ways (225 each).
  await Expense.create({
    groupId: group._id,
    title: 'Groceries',
    amount: 900,
    paidBy: alice._id,
    splitType: 'everyone',
    splitBetween: [alice._id, bob._id, carol._id, dave._id],
    splitDetails: [
      { user: alice._id, share: 225 },
      { user: bob._id, share: 225 },
      { user: carol._id, share: 225 },
      { user: dave._id, share: 225 },
    ],
    paymentMode: 'upi',
    date: D('2026-09-03T10:00:00.000Z'),
    notes: 'Weekly run',
    screenshotUrl: 'https://example.test/r.png',
  });

  // E2: Bob pays 300, split between Alice + Bob only (150 each).
  await Expense.create({
    groupId: group._id,
    title: '=HYPERLINK("http://evil","Dinner")',
    amount: 300,
    paidBy: bob._id,
    splitType: 'specific',
    splitBetween: [alice._id, bob._id],
    splitDetails: [
      { user: alice._id, share: 150 },
      { user: bob._id, share: 150 },
    ],
    paymentMode: 'cash',
    date: D('2026-09-10T10:00:00.000Z'),
  });

  // E3: Carol pays 100.55, split Carol + Alice (50.28 / 50.27 style decimals).
  await Expense.create({
    groupId: group._id,
    title: 'Chai ₹ & snacks',
    amount: 100.55,
    paidBy: carol._id,
    splitType: 'specific',
    splitBetween: [alice._id, carol._id],
    splitDetails: [
      { user: alice._id, share: 50.28 },
      { user: carol._id, share: 50.27 },
    ],
    paymentMode: 'cash',
    date: D('2026-09-15T10:00:00.000Z'),
  });

  // E4: expense that does NOT involve Alice at all (Bob pays for Carol + Dave).
  await Expense.create({
    groupId: group._id,
    title: 'Bob solo outing',
    amount: 200,
    paidBy: bob._id,
    splitType: 'specific',
    splitBetween: [carol._id, dave._id],
    splitDetails: [
      { user: carol._id, share: 100 },
      { user: dave._id, share: 100 },
    ],
    paymentMode: 'upi',
    date: D('2026-09-20T10:00:00.000Z'),
  });

  // E5: outside the September window, to prove date filtering bites.
  await Expense.create({
    groupId: group._id,
    title: 'August legacy',
    amount: 400,
    paidBy: alice._id,
    splitType: 'everyone',
    splitBetween: [alice._id, bob._id],
    splitDetails: [
      { user: alice._id, share: 200 },
      { user: bob._id, share: 200 },
    ],
    paymentMode: 'cash',
    date: D('2026-08-11T10:00:00.000Z'),
  });

  // --- Settlements: one of every status ---------------------------------
  await Settlement.create([
    {
      groupId: group._id, payer: bob._id, receiver: alice._id, amount: 100,
      paymentMethod: 'upi', status: 'completed', paidAt: D('2026-09-21T10:00:00.000Z'),
      verifiedAt: D('2026-09-21T11:00:00.000Z'), note: 'part payment',
      createdAt: D('2026-09-21T10:00:00.000Z'),
    },
    {
      groupId: group._id, payer: carol._id, receiver: alice._id, amount: 50,
      paymentMethod: 'upi', status: 'paid_pending_approval',
      createdAt: D('2026-09-22T10:00:00.000Z'),
    },
    {
      groupId: group._id, payer: dave._id, receiver: alice._id, amount: 225,
      paymentMethod: 'cash', status: 'will_pay_soon',
      createdAt: D('2026-09-23T10:00:00.000Z'),
    },
    {
      groupId: group._id, payer: alice._id, receiver: bob._id, amount: 20,
      paymentMethod: 'upi', status: 'rejected', rejectionReason: 'Wrong amount',
      createdAt: D('2026-09-24T10:00:00.000Z'),
    },
    {
      groupId: group._id, payer: alice._id, receiver: carol._id, amount: 10,
      paymentMethod: 'cash', status: 'cancelled',
      createdAt: D('2026-09-25T10:00:00.000Z'),
    },
  ]);
};

const septemberFilters = () => {
  const parsed = parseReportFilters({
    from: '2026-09-01T00:00:00.000Z',
    to: '2026-09-30T23:59:59.999Z',
    involvement: 'all',
    paymentMode: 'all',
    tz: '0',
    rangeLabel: 'September 2026',
  });
  assert(parsed.ok, 'September filters must parse');
  return parsed.filters;
};

const run = async () => {
  console.log('🧪 Reporting & Export Tests\n');
  console.log(`   Connecting to ${TEST_URI}`);
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 5000 });
  await seed();

  const membership = await GroupMember.findOne({ groupId: group._id, userId: alice._id });
  const aliceId = alice._id.toString();

  // =====================================================================
  console.log('\n1. Filter validation');
  // =====================================================================
  check('rejects reversed date range', () => {
    const r = parseReportFilters({ from: '2026-09-30', to: '2026-09-01' });
    assert.strictEqual(r.ok, false);
  });
  check('rejects unknown involvement', () => {
    assert.strictEqual(parseReportFilters({ involvement: 'nope' }).ok, false);
  });
  check('rejects unknown paymentMode', () => {
    assert.strictEqual(parseReportFilters({ paymentMode: 'bitcoin' }).ok, false);
  });
  check('rejects malformed memberId', () => {
    assert.strictEqual(parseReportFilters({ memberId: '../../etc/passwd' }).ok, false);
  });
  check('rejects out-of-bounds tz offset', () => {
    assert.strictEqual(parseReportFilters({ tz: '9999' }).ok, false);
  });
  check('accepts empty query as All Time', () => {
    const r = parseReportFilters({});
    assert(r.ok);
    assert.strictEqual(r.filters.start, null);
    assert.strictEqual(r.filters.end, null);
  });
  check('strips control characters from rangeLabel', () => {
    const r = parseReportFilters({ rangeLabel: 'Sep 2026' });
    assert.strictEqual(r.filters.rangeLabel, 'Sep2026');
  });
  check('start date == end date is a valid single-day range', () => {
    const r = parseReportFilters({ from: '2026-09-10T00:00:00.000Z', to: '2026-09-10T23:59:59.999Z' });
    assert(r.ok);
  });

  // =====================================================================
  console.log('\n2. Period bucketing (no UTC off-by-one)');
  // =====================================================================
  check('IST bucket keeps late-evening expense on the local day', () => {
    // 2026-09-03T19:30Z == 2026-09-04 01:00 IST -> must bucket as the 4th, not the 3rd.
    const b = bucketFor(D('2026-09-03T19:30:00.000Z'), 'day', 330);
    assert.strictEqual(b.key, '2026-09-04');
  });
  check('UTC bucket keeps the same instant on the 3rd', () => {
    assert.strictEqual(bucketFor(D('2026-09-03T19:30:00.000Z'), 'day', 0).key, '2026-09-03');
  });
  check('auto grouping picks day for a one-month range', () => {
    assert.strictEqual(resolveGrouping('auto', D('2026-09-01'), D('2026-09-30'), []), 'day');
  });
  check('auto grouping picks month for a multi-year range', () => {
    assert.strictEqual(resolveGrouping('auto', D('2020-01-01'), D('2026-09-30'), []), 'month');
  });

  // =====================================================================
  console.log('\n3. Involvement filter semantics');
  // =====================================================================
  const allSept = await Expense.find({
    groupId: group._id,
    date: { $gte: D('2026-09-01T00:00:00.000Z'), $lte: D('2026-09-30T23:59:59.999Z') },
  }).lean();

  check('all -> 4 September expenses', () => {
    assert.strictEqual(allSept.filter((e) => matchesInvolvement(e, aliceId, 'all')).length, 4);
  });
  check('involving_me -> 3 (excludes Bob solo outing)', () => {
    assert.strictEqual(allSept.filter((e) => matchesInvolvement(e, aliceId, 'involving_me')).length, 3);
  });
  check('paid_by_me -> 1 (Groceries)', () => {
    const r = allSept.filter((e) => matchesInvolvement(e, aliceId, 'paid_by_me'));
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].title, 'Groceries');
  });
  check('paid_by_others_for_me -> 2 (Dinner, Chai)', () => {
    assert.strictEqual(
      allSept.filter((e) => matchesInvolvement(e, aliceId, 'paid_by_others_for_me')).length,
      2
    );
  });

  // =====================================================================
  console.log('\n4. September report — attribution maths');
  // =====================================================================
  const report = await buildReport(aliceId, group, membership, septemberFilters());

  check('expense count excludes the August expense', () => {
    assert.strictEqual(report.periodSummary.expenseCount, 4);
  });
  check('total expense = 900 + 300 + 100.55 + 200', () => {
    eqMoney(report.periodSummary.totalExpense, 1500.55, 'totalExpense');
  });
  check('total paid by Alice = 900 (Groceries only)', () => {
    eqMoney(report.periodSummary.totalPaidByMe, 900, 'totalPaidByMe');
  });
  check("Alice's share = 225 + 150 + 50.28", () => {
    eqMoney(report.periodSummary.myShare, 425.28, 'myShare');
  });
  check('paid for others = 900 - her own 225 = 675', () => {
    eqMoney(report.periodSummary.paidForOthers, 675, 'paidForOthers');
  });
  check('paid by others for Alice = 150 + 50.28 = 200.28', () => {
    eqMoney(report.periodSummary.paidByOthersForMe, 200.28, 'paidByOthersForMe');
  });
  check('average expense = 1500.55 / 4', () => {
    eqMoney(report.periodSummary.averageExpense, 375.14, 'averageExpense');
  });
  check('largest expense is Groceries at 900', () => {
    assert.strictEqual(report.periodSummary.largestExpense.title, 'Groceries');
    eqMoney(report.periodSummary.largestExpense.amount, 900, 'largestExpense');
  });

  // =====================================================================
  console.log('\n5. RECONCILIATION — derived totals must agree');
  // =====================================================================
  check('sum(periodBreakdown.totalExpense) == periodSummary.totalExpense', () => {
    eqMoney(sum(report.periodBreakdown, 'totalExpense'), report.periodSummary.totalExpense, 'breakdown total');
  });
  check('sum(periodBreakdown.paidByMe) == periodSummary.totalPaidByMe', () => {
    eqMoney(sum(report.periodBreakdown, 'paidByMe'), report.periodSummary.totalPaidByMe, 'breakdown paidByMe');
  });
  check('sum(periodBreakdown.myShare) == periodSummary.myShare', () => {
    eqMoney(sum(report.periodBreakdown, 'myShare'), report.periodSummary.myShare, 'breakdown myShare');
  });
  check('sum(periodBreakdown.paidForOthers) == periodSummary.paidForOthers', () => {
    eqMoney(sum(report.periodBreakdown, 'paidForOthers'), report.periodSummary.paidForOthers, 'breakdown forOthers');
  });
  check('sum(periodBreakdown.paidByOthersForMe) == periodSummary.paidByOthersForMe', () => {
    eqMoney(sum(report.periodBreakdown, 'paidByOthersForMe'), report.periodSummary.paidByOthersForMe, 'breakdown byOthers');
  });
  check('sum(relationships.iPaidForThem) == periodSummary.paidForOthers', () => {
    eqMoney(sum(report.relationships, 'iPaidForThem'), report.periodSummary.paidForOthers, 'relationship iPaid');
  });
  check('sum(relationships.theyPaidForMe) == periodSummary.paidByOthersForMe', () => {
    eqMoney(sum(report.relationships, 'theyPaidForMe'), report.periodSummary.paidByOthersForMe, 'relationship theyPaid');
  });
  check('periodBreakdown expense ids == filtered expense count', () => {
    const ids = report.periodBreakdown.reduce((acc, p) => acc + p.expenseIds.length, 0);
    assert.strictEqual(ids, report.periodSummary.expenseCount);
  });

  // =====================================================================
  console.log('\n6. RECONCILIATION — live balances come from the balance engine');
  // =====================================================================
  const engine = await calculateGroupBalances(group._id, aliceId);

  check('report.youNeedToPayTotal == engine value', () => {
    eqMoney(report.balances.youNeedToPayTotal, engine.currentUserSummary.youNeedToPayTotal, 'owe total');
  });
  check('report.youWillReceiveTotal == engine value', () => {
    eqMoney(report.balances.youWillReceiveTotal, engine.currentUserSummary.youWillReceiveTotal, 'receive total');
  });
  check('netBalance == receive - owe', () => {
    eqMoney(
      report.balances.netBalance,
      engine.currentUserSummary.youWillReceiveTotal - engine.currentUserSummary.youNeedToPayTotal,
      'net'
    );
  });
  check('sum(peopleWhoOweMe.amount) == youWillReceiveTotal', () => {
    eqMoney(sum(report.peopleWhoOweMe, 'amount'), report.balances.youWillReceiveTotal, 'receivables');
  });
  check('sum(peopleIOwe.amount) == youNeedToPayTotal', () => {
    eqMoney(sum(report.peopleIOwe, 'amount'), report.balances.youNeedToPayTotal, 'payables');
  });
  check('relationship iCurrentlyOwe matches the engine per person', () => {
    for (const r of report.relationships) {
      const fromEngine = (engine.currentUserSummary.youNeedToPayList || [])
        .find((o) => o.user._id.toString() === r.person._id);
      eqMoney(r.iCurrentlyOwe, fromEngine ? fromEngine.amount : 0, `owe ${r.person.fullName}`);
    }
  });
  check('relationship theyCurrentlyOwe matches the engine per person', () => {
    for (const r of report.relationships) {
      const fromEngine = (engine.currentUserSummary.youWillReceiveList || [])
        .find((o) => o.user._id.toString() === r.person._id);
      eqMoney(r.theyCurrentlyOwe, fromEngine ? fromEngine.amount : 0, `owed by ${r.person.fullName}`);
    }
  });

  // =====================================================================
  console.log('\n7. Only completed settlements move money');
  // =====================================================================
  // Balances are deliberately all-time: the September report window does not hide the August
  // expense, because an unsettled debt does not stop existing just because you changed the filter.
  // Bob owes Alice 225 (Sep Groceries) + 200 (Aug legacy) - 100 (completed) = 325.
  check('completed settlement reduces the debt, all-time (425 - 100 = 325)', () => {
    const bobRel = report.relationships.find((r) => r.person._id === bob._id.toString());
    eqMoney(bobRel.theyCurrentlyOwe, 325, 'Bob owes Alice');
  });
  check('balances ignore the report date range by design', () => {
    const septOnly = report.relationships.find((r) => r.person._id === bob._id.toString());
    // 325 proves the August expense is still counted despite a September-only filter.
    assert(septOnly.theyCurrentlyOwe > 225, 'all-time debt must exceed the in-range portion');
  });
  check('directional debt preserved: Alice still owes Bob 150', () => {
    const bobRel = report.relationships.find((r) => r.person._id === bob._id.toString());
    eqMoney(bobRel.iCurrentlyOwe, 150, 'Alice owes Bob');
  });
  check('pending settlement does NOT reduce Carol\'s debt', () => {
    // Carol owes Alice 225 (Groceries); her 50 is only paid_pending_approval.
    const carolRel = report.relationships.find((r) => r.person._id === carol._id.toString());
    eqMoney(carolRel.theyCurrentlyOwe, 225, 'Carol owes Alice');
  });
  check('will_pay_soon does NOT reduce Dave\'s debt', () => {
    const daveRel = report.relationships.find((r) => r.person._id === dave._id.toString());
    eqMoney(daveRel.theyCurrentlyOwe, 225, 'Dave owes Alice');
  });
  check('rejected settlement does not create a credit', () => {
    const bobRel = report.relationships.find((r) => r.person._id === bob._id.toString());
    eqMoney(bobRel.iCurrentlyOwe, 150, 'rejected must not reduce');
  });

  // =====================================================================
  console.log('\n8. Attention centre uses existing statuses only');
  // =====================================================================
  check('one payment awaits Alice\'s approval (Carol)', () => {
    assert.strictEqual(report.attention.awaitingMyApproval.length, 1);
    assert.strictEqual(report.attention.awaitingMyApproval[0].payer.fullName, 'Carol ₹ Näme');
  });
  check('one rejected settlement needs Alice\'s action', () => {
    assert.strictEqual(report.attention.rejectedNeedingAction.length, 1);
  });
  check('one promise made to Alice (Dave)', () => {
    assert.strictEqual(report.attention.promisesToMe.length, 1);
  });
  check('cancelled settlement is not surfaced as actionable', () => {
    const ids = [
      ...report.attention.awaitingMyApproval,
      ...report.attention.rejectedNeedingAction,
      ...report.attention.myPromises,
      ...report.attention.promisesToMe,
    ].map((s) => s.status);
    assert(!ids.includes('cancelled'));
  });

  // =====================================================================
  console.log('\n9. Filter combinations');
  // =====================================================================
  const involvingMe = await buildReport(aliceId, group, membership, {
    ...septemberFilters(), involvement: 'involving_me',
  });
  check('involving_me drops the Bob-solo expense', () => {
    assert.strictEqual(involvingMe.periodSummary.expenseCount, 3);
    eqMoney(involvingMe.periodSummary.totalExpense, 1300.55, 'involving_me total');
  });

  const cashOnly = await buildReport(aliceId, group, membership, {
    ...septemberFilters(), paymentMode: 'cash',
  });
  check('cash filter keeps Dinner + Chai only', () => {
    assert.strictEqual(cashOnly.periodSummary.expenseCount, 2);
    eqMoney(cashOnly.periodSummary.totalExpense, 400.55, 'cash total');
  });

  const memberScoped = await buildReport(aliceId, group, membership, {
    ...septemberFilters(), memberId: bob._id.toString(),
  });
  check('member filter keeps only expenses involving Bob', () => {
    assert.strictEqual(memberScoped.periodSummary.expenseCount, 3);
  });
  check('member filter narrows the relationship table to that person', () => {
    assert.strictEqual(memberScoped.relationships.length, 1);
    assert.strictEqual(memberScoped.relationships[0].person._id, bob._id.toString());
  });

  const combined = await buildReport(aliceId, group, membership, {
    ...septemberFilters(), involvement: 'paid_by_me', paymentMode: 'upi',
  });
  check('combined paid_by_me + upi -> Groceries only', () => {
    assert.strictEqual(combined.periodSummary.expenseCount, 1);
    eqMoney(combined.periodSummary.totalPaidByMe, 900, 'combined paid');
  });

  const emptyRange = await buildReport(aliceId, group, membership, {
    ...septemberFilters(),
    start: D('2026-07-01T00:00:00.000Z'),
    end: D('2026-07-31T23:59:59.999Z'),
  });
  check('empty range yields zeroed analytics, not NaN', () => {
    assert.strictEqual(emptyRange.periodSummary.expenseCount, 0);
    eqMoney(emptyRange.periodSummary.totalExpense, 0, 'empty total');
    eqMoney(emptyRange.periodSummary.averageExpense, 0, 'empty average');
    assert.strictEqual(emptyRange.periodBreakdown.length, 0);
  });
  check('empty range still reports live outstanding balances', () => {
    eqMoney(emptyRange.balances.youWillReceiveTotal, report.balances.youWillReceiveTotal, 'balances ignore range');
  });

  const singleDay = await buildReport(aliceId, group, membership, {
    ...septemberFilters(),
    start: D('2026-09-10T00:00:00.000Z'),
    end: D('2026-09-10T23:59:59.999Z'),
  });
  check('start == end single-day range returns that day only', () => {
    assert.strictEqual(singleDay.periodSummary.expenseCount, 1);
    eqMoney(singleDay.periodSummary.totalExpense, 300, 'single day');
  });

  const allTime = await buildReport(aliceId, group, membership, {
    ...septemberFilters(), start: null, end: null,
  });
  check('All Time includes the August expense', () => {
    assert.strictEqual(allTime.periodSummary.expenseCount, 5);
    eqMoney(allTime.periodSummary.totalExpense, 1900.55, 'all time total');
  });

  // =====================================================================
  console.log('\n10. Billing cycle contract');
  // =====================================================================
  check('report exposes a populated billingCycle', () => {
    assert.strictEqual(report.billingCycle.payday, 5);
    assert(report.billingCycle.startDate instanceof Date);
    assert(report.billingCycle.endDate instanceof Date);
    assert(typeof report.billingCycle.daysRemaining === 'number');
  });
  check('null payday yields a safe empty cycle', async () => {
    const g = { ...group.toObject(), payday: null };
    assert.strictEqual(require('../utils/billingCycle').calculateBillingCycle(g.payday).payday, null);
  });

  // =====================================================================
  console.log('\n11. Excel workbook generation');
  // =====================================================================
  const dataset = await buildExportDataset(aliceId, group, membership, septemberFilters());
  const { buffer, filename } = await generateFinancialReport({
    report: dataset.report,
    fullExpenses: dataset.fullExpenses,
    user: alice,
  });

  check('produces a non-trivial xlsx buffer', () => {
    assert(Buffer.isBuffer(buffer));
    assert(buffer.length > 5000, `buffer only ${buffer.length} bytes`);
  });
  check('filename is sanitised and dated', () => {
    assert(/^SplitWise-Report-Flat-304-\d{4}-\d{2}-\d{2}\.xlsx$/.test(filename), filename);
  });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  check('workbook has all six sheets', () => {
    const names = wb.worksheets.map((w) => w.name);
    assert.deepStrictEqual(names, [
      'Summary', 'Expenses', 'Expense Splits',
      'Person-wise Relationship', 'Settlements', 'Daily Breakdown',
    ]);
  });
  check('Expenses sheet row count == filtered expenses', () => {
    const sheet = wb.getWorksheet('Expenses');
    assert.strictEqual(sheet.rowCount - 1, dataset.fullExpenses.length);
    assert.strictEqual(sheet.rowCount - 1, 4);
  });
  check('Expense Splits sheet row count == total split rows', () => {
    const expected = dataset.fullExpenses.reduce((a, e) => a + e.splitDetails.length, 0);
    assert.strictEqual(wb.getWorksheet('Expense Splits').rowCount - 1, expected);
  });
  check('Settlements sheet lists every in-range settlement', () => {
    assert.strictEqual(wb.getWorksheet('Settlements').rowCount - 1, dataset.report.settlements.length);
  });
  check('Breakdown TOTAL row reconciles with the Summary figures', () => {
    const sheet = wb.getWorksheet('Daily Breakdown');
    let totalRow = null;
    sheet.eachRow((row) => {
      if (row.getCell(1).value === 'TOTAL') totalRow = row;
    });
    assert(totalRow, 'TOTAL row must exist');
    eqMoney(totalRow.getCell(3).value, dataset.report.periodSummary.totalExpense, 'xlsx total expense');
    eqMoney(totalRow.getCell(4).value, dataset.report.periodSummary.totalPaidByMe, 'xlsx paid by me');
    eqMoney(totalRow.getCell(5).value, dataset.report.periodSummary.myShare, 'xlsx my share');
    eqMoney(totalRow.getCell(6).value, dataset.report.periodSummary.paidForOthers, 'xlsx for others');
    eqMoney(totalRow.getCell(7).value, dataset.report.periodSummary.paidByOthersForMe, 'xlsx by others');
  });
  check('sum of Expenses sheet amounts == Summary total', () => {
    const sheet = wb.getWorksheet('Expenses');
    let totalP = 0;
    sheet.eachRow((row, i) => {
      if (i === 1) return;
      totalP += Math.round(Number(row.getCell(4).value) * 100);
    });
    eqMoney(totalP / 100, dataset.report.periodSummary.totalExpense, 'xlsx expense sum');
  });
  check('sum of My Share column == Summary my share', () => {
    const sheet = wb.getWorksheet('Expenses');
    let totalP = 0;
    sheet.eachRow((row, i) => {
      if (i === 1) return;
      totalP += Math.round(Number(row.getCell(9).value) * 100);
    });
    eqMoney(totalP / 100, dataset.report.periodSummary.myShare, 'xlsx share sum');
  });
  check('formula-injection strings are neutralised', () => {
    const sheet = wb.getWorksheet('Expenses');
    let found = false;
    sheet.eachRow((row, i) => {
      if (i === 1) return;
      const title = row.getCell(3).value;
      if (typeof title === 'string' && title.includes('Dinner')) {
        found = true;
        assert(title.startsWith("'="), `expected neutralised title, got ${title}`);
      }
    });
    assert(found, 'the =HYPERLINK expense title must be present');
  });
  check('unicode name with ₹ survives the round trip', () => {
    const sheet = wb.getWorksheet('Person-wise Relationship');
    let found = false;
    sheet.eachRow((row, i) => {
      if (i === 1) return;
      if (String(row.getCell(1).value).includes('Näme')) found = true;
    });
    assert(found, 'Carol ₹ Näme must appear intact');
  });
  check('receipt / notes gaps render as explicit values not blanks', () => {
    const sheet = wb.getWorksheet('Expenses');
    const values = [];
    sheet.eachRow((row, i) => { if (i > 1) values.push(row.getCell(12).value); });
    assert(values.includes('Yes'), 'expense with a receipt must say Yes');
    assert(values.includes('No'), 'expense without a receipt must say No');
  });

  // Empty-dataset export must still succeed.
  const emptyDataset = await buildExportDataset(aliceId, group, membership, {
    ...septemberFilters(),
    start: D('2026-07-01T00:00:00.000Z'),
    end: D('2026-07-31T23:59:59.999Z'),
  });
  const emptyBook = await generateFinancialReport({
    report: emptyDataset.report,
    fullExpenses: emptyDataset.fullExpenses,
    user: alice,
  });
  check('empty dataset still produces a valid workbook', () => {
    assert(Buffer.isBuffer(emptyBook.buffer));
    assert(emptyBook.buffer.length > 3000);
  });

  // =====================================================================
  console.log('\n12. Edge cases');
  // =====================================================================
  const daveMembership = await GroupMember.findOne({ groupId: group._id, userId: dave._id });
  const daveReport = await buildReport(dave._id.toString(), group, daveMembership, septemberFilters());
  check('user who owes but is owed nothing', () => {
    eqMoney(daveReport.balances.youWillReceiveTotal, 0, 'Dave receivables');
    assert(daveReport.balances.youNeedToPayTotal > 0);
    assert.strictEqual(daveReport.peopleWhoOweMe.length, 0);
  });
  check('user who never paid has zero paidForOthers', () => {
    eqMoney(daveReport.periodSummary.totalPaidByMe, 0, 'Dave paid');
    eqMoney(daveReport.periodSummary.paidForOthers, 0, 'Dave for others');
  });

  const emptyUser = await User.create({
    fullName: 'Zoe Nobody', email: 'zoe@test.local', phone: '9', password: 'x'.repeat(60),
  });
  const emptyGroup = await Group.create({
    name: 'Empty Flat', inviteCode: 'TEST02', inviteToken: 'tok-empty', createdBy: emptyUser._id,
  });
  const emptyMembership = await GroupMember.create({
    groupId: emptyGroup._id, userId: emptyUser._id, role: 'creator',
  });
  const zeroReport = await buildReport(
    emptyUser._id.toString(), emptyGroup, emptyMembership, septemberFilters()
  );
  check('brand new group with no expenses returns safe zeros', () => {
    assert.strictEqual(zeroReport.periodSummary.expenseCount, 0);
    eqMoney(zeroReport.balances.netBalance, 0, 'zero net');
    assert.strictEqual(zeroReport.relationships.length, 0);
    assert.strictEqual(zeroReport.recentExpenses.length, 0);
    assert.strictEqual(zeroReport.attention.totalActionable, 0);
  });
  check('new group export does not throw', async () => {
    assert(zeroReport.billingCycle);
  });

  check('recent expenses are capped and carry my share', () => {
    assert(report.recentExpenses.length <= 8);
    const groceries = report.recentExpenses.find((e) => e.title === 'Groceries');
    eqMoney(groceries.myShare, 225, 'recent myShare');
    assert.strictEqual(groceries.involvement, 'paid_by_me');
    assert.strictEqual(groceries.participantCount, 4);
    assert.strictEqual(groceries.hasReceipt, true);
  });

  // =====================================================================
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${'='.repeat(52)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log('='.repeat(52));
  if (failed > 0) process.exit(1);
  console.log('✅ All reporting & export tests passed.\n');
};

run().catch(async (err) => {
  console.error('\n💥 Test run crashed:', err);
  try { await mongoose.disconnect(); } catch (_) { /* already closed */ }
  process.exit(1);
});
