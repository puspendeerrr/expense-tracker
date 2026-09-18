/**
 * Excel Export Service — builds a real .xlsx workbook from the reporting service output.
 *
 * Every figure written here comes from `reportingService.buildExportDataset`, which is the same
 * function that feeds the dashboard. Nothing is recalculated in this file, so the workbook and
 * the screen can never disagree.
 */

const ExcelJS = require('exceljs');

const BRAND = '2563EB';
const HEADER_FILL = 'FF1E293B';
const SUBHEAD_FILL = 'FFF1F5F9';

const MONEY_FMT = '₹#,##0.00';
const DATE_FMT = 'dd mmm yyyy';
const DATETIME_FMT = 'dd mmm yyyy, hh:mm AM/PM';

const INVOLVEMENT_LABELS = {
  all: 'All Group Expenses',
  involving_me: 'Involving Me',
  paid_by_me: 'Paid By Me',
  paid_by_others_for_me: 'Paid By Others For Me',
};

const PAYMENT_LABELS = { all: 'All', cash: 'Cash', upi: 'UPI / Online' };

const STATUS_LABELS = {
  completed: 'Completed',
  paid_pending_approval: 'Pending Verification',
  will_pay_soon: 'Will Pay Soon',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

/**
 * Excel treats a leading =, +, - or @ as a formula. User-controlled text (titles, notes, names)
 * is prefixed with an apostrophe so a malicious value cannot execute in a spreadsheet client.
 */
const safeText = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) return `'${str}`;
  return str;
};

const asDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

/** Apply the shared header-row treatment to a sheet's first row. */
const styleHeaderRow = (sheet, rowNumber = 1) => {
  const row = sheet.getRow(rowNumber);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 22;
  sheet.views = [{ state: 'frozen', ySplit: rowNumber }];
};

/** Add a banded border + auto filter to a populated table. */
const finaliseTable = (sheet, headerRow, columnCount) => {
  if (sheet.rowCount > headerRow) {
    sheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow, column: columnCount },
    };
  }
};

// ==========================================================
// SHEET 1 — SUMMARY
// ==========================================================

const buildSummarySheet = (workbook, report, user) => {
  const sheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: `FF${BRAND}` } },
  });

  sheet.columns = [
    { key: 'label', width: 32 },
    { key: 'value', width: 42 },
  ];

  const titleRow = sheet.addRow(['SplitWise — Financial Report', '']);
  titleRow.font = { bold: true, size: 16, color: { argb: `FF${BRAND}` } };
  titleRow.height = 26;
  sheet.mergeCells(`A${titleRow.number}:B${titleRow.number}`);
  sheet.addRow([]);

  const section = (label) => {
    const r = sheet.addRow([label, '']);
    r.font = { bold: true, size: 11 };
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEAD_FILL } };
    sheet.mergeCells(`A${r.number}:B${r.number}`);
    return r;
  };

  const kv = (label, value, numFmt) => {
    const r = sheet.addRow([label, value]);
    r.getCell(1).font = { bold: true, color: { argb: 'FF475569' } };
    if (numFmt) r.getCell(2).numFmt = numFmt;
    return r;
  };

  section('Report Context');
  kv('User', safeText(user.fullName));
  kv('Email', safeText(user.email));
  kv('Group', safeText(report.group.name));
  kv('Role in Group', report.group.userRole === 'creator' ? 'Group Admin' : 'Member');
  kv('Exported At', asDate(report.generatedAt)).getCell(2).numFmt = DATETIME_FMT;

  sheet.addRow([]);
  section('Applied Filters');
  kv('Date Range', safeText(report.filters.rangeLabel || 'All Time'));
  kv('From', report.filters.from ? asDate(report.filters.from) : 'Beginning').getCell(2).numFmt =
    report.filters.from ? DATE_FMT : 'General';
  kv('To', report.filters.to ? asDate(report.filters.to) : 'Today').getCell(2).numFmt =
    report.filters.to ? DATE_FMT : 'General';
  kv('Person', safeText(report.filters.memberName));
  kv('Payment Mode', PAYMENT_LABELS[report.filters.paymentMode] || report.filters.paymentMode);
  kv('Involvement', INVOLVEMENT_LABELS[report.filters.involvement] || report.filters.involvement);

  sheet.addRow([]);
  section('Spending In Selected Period');
  kv('Total Expenses (count)', report.periodSummary.expenseCount);
  kv('Total Expense Value', report.periodSummary.totalExpense, MONEY_FMT);
  kv('Total Paid By Me', report.periodSummary.totalPaidByMe, MONEY_FMT);
  kv('My Total Share', report.periodSummary.myShare, MONEY_FMT);
  kv('Paid For Others', report.periodSummary.paidForOthers, MONEY_FMT);
  kv('Paid By Others For Me', report.periodSummary.paidByOthersForMe, MONEY_FMT);
  kv('Average Expense', report.periodSummary.averageExpense, MONEY_FMT);
  kv(
    'Largest Expense',
    report.periodSummary.largestExpense
      ? `${safeText(report.periodSummary.largestExpense.title)}`
      : 'None'
  );
  kv(
    'Largest Expense Amount',
    report.periodSummary.largestExpense ? report.periodSummary.largestExpense.amount : 0,
    MONEY_FMT
  );

  sheet.addRow([]);
  section('Current Outstanding Position (all time, not date-filtered)');
  kv('Amount I Currently Owe', report.balances.youNeedToPayTotal, MONEY_FMT);
  kv('People I Owe', report.balances.peopleIOweCount);
  kv('Amount Currently Owed To Me', report.balances.youWillReceiveTotal, MONEY_FMT);
  kv('People Who Owe Me', report.balances.peopleWhoOweMeCount);
  kv('Net Balance', report.balances.netBalance, MONEY_FMT);

  sheet.addRow([]);
  const note = sheet.addRow([
    'Note:',
    'Outstanding balances reflect all unsettled activity to date and are deliberately not limited by the selected date range. Only completed settlements reduce a balance.',
  ]);
  note.getCell(1).font = { bold: true, italic: true, color: { argb: 'FF64748B' } };
  note.getCell(2).font = { italic: true, color: { argb: 'FF64748B' } };
  note.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  note.height = 34;

  return sheet;
};

// ==========================================================
// SHEET 2 — EXPENSES
// ==========================================================

const buildExpensesSheet = (workbook, fullExpenses, userId) => {
  const sheet = workbook.addWorksheet('Expenses');

  sheet.columns = [
    { header: 'Expense ID', key: 'id', width: 26 },
    { header: 'Date', key: 'date', width: 14, style: { numFmt: DATE_FMT } },
    { header: 'Title', key: 'title', width: 30 },
    { header: 'Total Amount', key: 'amount', width: 15, style: { numFmt: MONEY_FMT } },
    { header: 'Paid By', key: 'paidBy', width: 22 },
    { header: 'Payment Mode', key: 'mode', width: 14 },
    { header: 'Split Type', key: 'splitType', width: 14 },
    { header: 'Participants', key: 'participants', width: 13 },
    { header: 'My Share', key: 'myShare', width: 14, style: { numFmt: MONEY_FMT } },
    { header: 'My Involvement', key: 'involvement', width: 22 },
    { header: 'Notes', key: 'notes', width: 34 },
    { header: 'Receipt Available', key: 'receipt', width: 17 },
  ];

  styleHeaderRow(sheet);

  for (const e of fullExpenses) {
    const payerId = e.paidBy?._id ? e.paidBy._id.toString() : String(e.paidBy || '');
    const myRow = (e.splitDetails || []).find(
      (d) => (d.user?._id ? d.user._id.toString() : String(d.user)) === userId
    );

    let involvement = 'Not involved';
    if (payerId === userId && myRow) involvement = 'Paid by me (I benefited)';
    else if (payerId === userId) involvement = 'Paid by me (for others)';
    else if (myRow) involvement = 'Paid by others for me';

    sheet.addRow({
      id: e._id.toString(),
      date: asDate(e.date),
      title: safeText(e.title),
      amount: e.amount,
      paidBy: safeText(e.paidBy?.fullName || 'Unknown'),
      mode: e.paymentMode === 'upi' ? 'UPI / Online' : 'Cash',
      splitType: e.splitType === 'everyone' ? 'Split with everyone' : 'Specific members',
      participants: (e.splitDetails || []).length,
      myShare: myRow ? myRow.share : 0,
      involvement,
      notes: safeText(e.notes || ''),
      receipt: e.screenshotUrl ? 'Yes' : 'No',
    });
  }

  finaliseTable(sheet, 1, sheet.columns.length);
  return sheet;
};

// ==========================================================
// SHEET 3 — EXPENSE SPLITS
// ==========================================================

/**
 * A separate long-format sheet rather than one wide column per member — this stays readable and
 * pivotable no matter how large the group gets.
 */
const buildSplitsSheet = (workbook, fullExpenses) => {
  const sheet = workbook.addWorksheet('Expense Splits');

  sheet.columns = [
    { header: 'Expense ID', key: 'id', width: 26 },
    { header: 'Date', key: 'date', width: 14, style: { numFmt: DATE_FMT } },
    { header: 'Title', key: 'title', width: 30 },
    { header: 'Total Amount', key: 'amount', width: 15, style: { numFmt: MONEY_FMT } },
    { header: 'Paid By', key: 'paidBy', width: 22 },
    { header: 'Participant', key: 'participant', width: 22 },
    { header: 'Participant Share', key: 'share', width: 17, style: { numFmt: MONEY_FMT } },
    { header: 'Is Payer', key: 'isPayer', width: 10 },
  ];

  styleHeaderRow(sheet);

  for (const e of fullExpenses) {
    const payerId = e.paidBy?._id ? e.paidBy._id.toString() : String(e.paidBy || '');
    for (const row of e.splitDetails || []) {
      const pid = row.user?._id ? row.user._id.toString() : String(row.user);
      sheet.addRow({
        id: e._id.toString(),
        date: asDate(e.date),
        title: safeText(e.title),
        amount: e.amount,
        paidBy: safeText(e.paidBy?.fullName || 'Unknown'),
        participant: safeText(row.user?.fullName || 'Unknown'),
        share: row.share,
        isPayer: pid === payerId ? 'Yes' : 'No',
      });
    }
  }

  finaliseTable(sheet, 1, sheet.columns.length);
  return sheet;
};

// ==========================================================
// SHEET 4 — PERSON-WISE RELATIONSHIP
// ==========================================================

const buildRelationshipSheet = (workbook, report) => {
  const sheet = workbook.addWorksheet('Person-wise Relationship');

  sheet.columns = [
    { header: 'Person', key: 'person', width: 24 },
    { header: 'I Paid For Them', key: 'iPaid', width: 18, style: { numFmt: MONEY_FMT } },
    { header: 'They Paid For Me', key: 'theyPaid', width: 18, style: { numFmt: MONEY_FMT } },
    { header: 'I Currently Owe', key: 'iOwe', width: 18, style: { numFmt: MONEY_FMT } },
    { header: 'They Currently Owe', key: 'theyOwe', width: 19, style: { numFmt: MONEY_FMT } },
    { header: 'Net Relationship', key: 'net', width: 18, style: { numFmt: MONEY_FMT } },
    { header: 'Related Expenses', key: 'count', width: 17 },
    { header: 'Last Related Expense', key: 'last', width: 20, style: { numFmt: DATE_FMT } },
  ];

  styleHeaderRow(sheet);

  for (const r of report.relationships) {
    sheet.addRow({
      person: safeText(r.person.fullName),
      iPaid: r.iPaidForThem,
      theyPaid: r.theyPaidForMe,
      iOwe: r.iCurrentlyOwe,
      theyOwe: r.theyCurrentlyOwe,
      net: r.netRelationship,
      count: r.relatedExpenseCount,
      last: asDate(r.lastRelatedExpenseDate),
    });
  }

  sheet.addRow([]);
  const legend = sheet.addRow([
    'Definitions: "I Paid For Them" / "They Paid For Me" are spending attribution over the selected period. "I Currently Owe" / "They Currently Owe" are live outstanding obligations across all time, from the balance engine. "Net Relationship" is a display-only figure and does not replace the two directional obligations.',
  ]);
  legend.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
  sheet.mergeCells(`A${legend.number}:H${legend.number}`);
  legend.getCell(1).alignment = { wrapText: true, vertical: 'top' };
  legend.height = 44;

  finaliseTable(sheet, 1, sheet.columns.length);
  return sheet;
};

// ==========================================================
// SHEET 5 — SETTLEMENTS
// ==========================================================

const buildSettlementsSheet = (workbook, report) => {
  const sheet = workbook.addWorksheet('Settlements');

  sheet.columns = [
    { header: 'Settlement ID', key: 'id', width: 26 },
    { header: 'Created', key: 'created', width: 20, style: { numFmt: DATETIME_FMT } },
    { header: 'Payer', key: 'payer', width: 22 },
    { header: 'Receiver', key: 'receiver', width: 22 },
    { header: 'Amount', key: 'amount', width: 14, style: { numFmt: MONEY_FMT } },
    { header: 'Payment Method', key: 'method', width: 16 },
    { header: 'Status', key: 'status', width: 20 },
    { header: 'Paid At', key: 'paidAt', width: 20, style: { numFmt: DATETIME_FMT } },
    { header: 'Verified At', key: 'verifiedAt', width: 20, style: { numFmt: DATETIME_FMT } },
    { header: 'Affects Balance', key: 'affects', width: 16 },
    { header: 'Note', key: 'note', width: 28 },
    { header: 'Rejection Reason', key: 'reason', width: 28 },
  ];

  styleHeaderRow(sheet);

  for (const s of report.settlements) {
    sheet.addRow({
      id: s._id.toString(),
      created: asDate(s.createdAt),
      payer: safeText(s.payer?.fullName || 'Unknown'),
      receiver: safeText(s.receiver?.fullName || 'Unknown'),
      amount: s.amount,
      method: s.paymentMethod === 'cash' ? 'Cash' : 'UPI',
      status: STATUS_LABELS[s.status] || s.status,
      paidAt: asDate(s.paidAt),
      verifiedAt: asDate(s.verifiedAt),
      affects: s.status === 'completed' ? 'Yes' : 'No',
      note: safeText(s.note || ''),
      reason: safeText(s.rejectionReason || ''),
    });
  }

  finaliseTable(sheet, 1, sheet.columns.length);
  return sheet;
};

// ==========================================================
// SHEET 6 — PERIOD BREAKDOWN
// ==========================================================

const buildBreakdownSheet = (workbook, report) => {
  const grouping = report.filters.grouping;
  const label = grouping === 'month' ? 'Monthly' : grouping === 'week' ? 'Weekly' : 'Daily';
  const sheet = workbook.addWorksheet(`${label} Breakdown`);

  sheet.columns = [
    { header: 'Period', key: 'period', width: 18 },
    { header: 'Expense Count', key: 'count', width: 15 },
    { header: 'Total Expense', key: 'total', width: 16, style: { numFmt: MONEY_FMT } },
    { header: 'Paid By Me', key: 'paidByMe', width: 16, style: { numFmt: MONEY_FMT } },
    { header: 'My Share', key: 'myShare', width: 16, style: { numFmt: MONEY_FMT } },
    { header: 'Paid For Others', key: 'forOthers', width: 17, style: { numFmt: MONEY_FMT } },
    { header: 'Paid By Others For Me', key: 'byOthers', width: 21, style: { numFmt: MONEY_FMT } },
  ];

  styleHeaderRow(sheet);

  for (const p of report.periodBreakdown) {
    sheet.addRow({
      period: p.label,
      count: p.expenseCount,
      total: p.totalExpense,
      paidByMe: p.paidByMe,
      myShare: p.myShare,
      forOthers: p.paidForOthers,
      byOthers: p.paidByOthersForMe,
    });
  }

  // Totals row — these must reconcile exactly with the Summary sheet.
  if (report.periodBreakdown.length > 0) {
    const totals = sheet.addRow({
      period: 'TOTAL',
      count: report.periodSummary.expenseCount,
      total: report.periodSummary.totalExpense,
      paidByMe: report.periodSummary.totalPaidByMe,
      myShare: report.periodSummary.myShare,
      forOthers: report.periodSummary.paidForOthers,
      byOthers: report.periodSummary.paidByOthersForMe,
    });
    totals.font = { bold: true };
    totals.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEAD_FILL } };
  }

  finaliseTable(sheet, 1, sheet.columns.length);
  return sheet;
};

// ==========================================================
// PUBLIC API
// ==========================================================

/**
 * Build the complete workbook.
 * @returns {Promise<{ buffer: Buffer, filename: string }>}
 */
const generateFinancialReport = async ({ report, fullExpenses, user }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SplitWise';
  workbook.lastModifiedBy = user.fullName || 'SplitWise';
  workbook.created = new Date();
  workbook.modified = new Date();

  const userId = user._id.toString();

  buildSummarySheet(workbook, report, user);
  buildExpensesSheet(workbook, fullExpenses, userId);
  buildSplitsSheet(workbook, fullExpenses);
  buildRelationshipSheet(workbook, report);
  buildSettlementsSheet(workbook, report);
  buildBreakdownSheet(workbook, report);

  const buffer = await workbook.xlsx.writeBuffer();

  const stamp = new Date().toISOString().slice(0, 10);
  const safeGroup = String(report.group.name || 'group')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'group';

  return {
    buffer: Buffer.from(buffer),
    filename: `SplitWise-Report-${safeGroup}-${stamp}.xlsx`,
  };
};

module.exports = { generateFinancialReport, safeText };
