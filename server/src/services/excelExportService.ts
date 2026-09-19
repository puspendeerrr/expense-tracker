import ExcelJS from 'exceljs';
import { paiseToRupees } from '../utils/money.js';
import type { ExportDataset } from './reportingService.js';

/**
 * Excel export.
 *
 * Every figure written here comes from `buildExportDataset`, which runs the same filter
 * pipeline that feeds the dashboard. Nothing is recalculated in this file, so the
 * workbook and the screen cannot disagree.
 */

const BRAND = 'FF2563EB';
const HEADER_FILL = 'FF1E293B';
const SUBHEAD_FILL = 'FFF1F5F9';
const BAND_FILL = 'FFF8FAFC';

const MONEY_FMT = '₹#,##0.00';
const DATE_FMT = 'dd mmm yyyy';
const DATETIME_FMT = 'dd mmm yyyy, hh:mm AM/PM';

const INVOLVEMENT_LABELS: Record<string, string> = {
  all: 'All group expenses',
  involving_me: 'Involving me',
  paid_by_me: 'Paid by me',
  paid_by_others_for_me: 'Paid by others for me',
  not_involved: 'Not involved',
};

const PAYMENT_LABELS: Record<string, string> = {
  all: 'All',
  cash: 'Cash',
  upi: 'UPI / Online',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  paid_pending_approval: 'Pending verification',
  will_pay_soon: 'Will pay soon',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const CATEGORY_LABELS: Record<string, string> = {
  groceries: 'Groceries',
  food_dining: 'Food & Dining',
  rent: 'Rent',
  utilities: 'Utilities',
  entertainment: 'Entertainment',
  travel: 'Travel',
  household: 'Household',
  medical: 'Medical',
  other: 'Other',
};

/**
 * Spreadsheet software treats a leading =, +, - or @ as a formula. User-controlled text
 * (titles, notes, names) is prefixed with an apostrophe so a crafted value such as
 * `=HYPERLINK(...)` cannot execute when the recipient opens the file.
 */
const safeText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
};

const rupees = (paise: number): number => paiseToRupees(paise);

const asDate = (value: string | Date | null): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Frozen, styled header row plus an auto-filter across the table. */
const styleTable = (sheet: ExcelJS.Worksheet, columnCount: number): void => {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  header.alignment = { vertical: 'middle', horizontal: 'left' };
  header.height = 22;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  if (sheet.rowCount > 1) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnCount } };
  }

  // Alternating bands, applied after the rows exist.
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    if (rowNumber % 2 === 0) {
      sheet.getRow(rowNumber).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BAND_FILL },
      };
    }
  }
};

/* -------------------------------------------------------------------------- */
/* Sheet 1 — Summary                                                          */
/* -------------------------------------------------------------------------- */

const buildSummarySheet = (
  workbook: ExcelJS.Workbook,
  dataset: ExportDataset,
  user: { fullName: string; email: string },
): void => {
  const { report } = dataset;
  const sheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: BRAND } },
  });

  sheet.columns = [
    { key: 'label', width: 38 },
    { key: 'value', width: 44 },
  ];

  const title = sheet.addRow(['SplitWise — Financial Report', '']);
  title.font = { bold: true, size: 16, color: { argb: BRAND } };
  title.height = 26;
  sheet.mergeCells(`A${title.number}:B${title.number}`);
  sheet.addRow([]);

  const section = (label: string): void => {
    const row = sheet.addRow([label, '']);
    row.font = { bold: true, size: 11 };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEAD_FILL } };
    sheet.mergeCells(`A${row.number}:B${row.number}`);
  };

  const kv = (label: string, value: unknown, numFmt?: string): void => {
    const row = sheet.addRow([label, value as ExcelJS.CellValue]);
    row.getCell(1).font = { bold: true, color: { argb: 'FF475569' } };
    if (numFmt) row.getCell(2).numFmt = numFmt;
  };

  section('Report context');
  kv('User', safeText(user.fullName));
  kv('Email', safeText(user.email));
  kv('Group', safeText(report.group.name));
  kv('Role in group', report.group.role === 'creator' ? 'Group creator' : 'Member');
  kv('Generated at', new Date(report.generatedAt), DATETIME_FMT);

  sheet.addRow([]);
  section('Applied filters');
  kv('Date range', safeText(report.filters.rangeLabel));
  kv('From', report.filters.from ? asDate(report.filters.from) : 'Beginning', report.filters.from ? DATE_FMT : undefined);
  kv('To', report.filters.to ? asDate(report.filters.to) : 'Today', report.filters.to ? DATE_FMT : undefined);
  kv('Person', safeText(report.filters.memberName));
  kv('Payment mode', PAYMENT_LABELS[report.filters.paymentMode] ?? report.filters.paymentMode);
  kv('Involvement', INVOLVEMENT_LABELS[report.filters.involvement] ?? report.filters.involvement);
  kv(
    'Category',
    report.filters.category
      ? (CATEGORY_LABELS[report.filters.category] ?? report.filters.category)
      : 'All',
  );

  sheet.addRow([]);
  section('Spending in the selected period');
  kv('Expenses (count)', report.periodSummary.expenseCount);
  kv('Total expense value', rupees(report.periodSummary.totalExpense.paise), MONEY_FMT);
  kv('Total paid by me', rupees(report.periodSummary.totalPaidByMe.paise), MONEY_FMT);
  kv('My total share', rupees(report.periodSummary.myShare.paise), MONEY_FMT);
  kv('Paid for others', rupees(report.periodSummary.paidForOthers.paise), MONEY_FMT);
  kv('Paid by others for me', rupees(report.periodSummary.paidByOthersForMe.paise), MONEY_FMT);
  kv('Average expense', rupees(report.periodSummary.averageExpense.paise), MONEY_FMT);
  kv('Largest expense', safeText(report.periodSummary.largestExpense?.title ?? 'None'));
  kv(
    'Largest expense amount',
    rupees(report.periodSummary.largestExpense?.amountPaise ?? 0),
    MONEY_FMT,
  );

  sheet.addRow([]);
  section('Current outstanding position (all time, not date-filtered)');
  kv('Amount I currently owe', rupees(report.balances.youNeedToPayTotal.paise), MONEY_FMT);
  kv('People I owe', report.balances.peopleIOweCount);
  kv('Amount currently owed to me', rupees(report.balances.youWillReceiveTotal.paise), MONEY_FMT);
  kv('People who owe me', report.balances.peopleWhoOweMeCount);
  kv('Net balance', rupees(report.balances.netBalance.paise), MONEY_FMT);

  sheet.addRow([]);
  const note = sheet.addRow([
    'Note:',
    'Outstanding balances reflect all unsettled activity to date and are deliberately not limited by the selected date range. Only completed settlements reduce a balance.',
  ]);
  note.getCell(1).font = { bold: true, italic: true, color: { argb: 'FF64748B' } };
  note.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  note.height = 44;
};

/* -------------------------------------------------------------------------- */
/* Sheet 2 — Expenses                                                         */
/* -------------------------------------------------------------------------- */

const buildExpensesSheet = (workbook: ExcelJS.Workbook, dataset: ExportDataset): void => {
  const sheet = workbook.addWorksheet('Expenses');

  sheet.columns = [
    { header: 'Expense ID', key: 'id', width: 38 },
    { header: 'Date', key: 'date', width: 14, style: { numFmt: DATE_FMT } },
    { header: 'Title', key: 'title', width: 30 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Total amount', key: 'amount', width: 15, style: { numFmt: MONEY_FMT } },
    { header: 'Paid by', key: 'payer', width: 22 },
    { header: 'Payment mode', key: 'mode', width: 15 },
    { header: 'Split type', key: 'split', width: 13 },
    { header: 'Participants', key: 'count', width: 13 },
    { header: 'My share', key: 'myShare', width: 14, style: { numFmt: MONEY_FMT } },
    { header: 'My involvement', key: 'involvement', width: 24 },
    { header: 'Notes', key: 'notes', width: 34 },
    { header: 'Receipt', key: 'receipt', width: 10 },
  ];

  for (const expense of dataset.expenses) {
    sheet.addRow({
      id: expense.id,
      date: asDate(expense.expenseDate),
      title: safeText(expense.title),
      category: expense.category ? (CATEGORY_LABELS[expense.category] ?? expense.category) : '—',
      amount: rupees(expense.amountPaise),
      payer: safeText(expense.payerName),
      mode: PAYMENT_LABELS[expense.paymentMode] ?? expense.paymentMode,
      split: expense.splitType === 'everyone' ? 'Everyone' : 'Specific',
      count: expense.participantCount,
      myShare: rupees(expense.mySharePaise),
      involvement: INVOLVEMENT_LABELS[expense.involvement] ?? expense.involvement,
      notes: safeText(expense.notes),
      receipt: expense.hasReceipt ? 'Yes' : 'No',
    });
  }

  styleTable(sheet, 13);
};

/* -------------------------------------------------------------------------- */
/* Sheet 3 — Expense splits                                                   */
/* -------------------------------------------------------------------------- */

/** Long-format relational sheet, shaped for pivot tables. */
const buildSplitsSheet = (workbook: ExcelJS.Workbook, dataset: ExportDataset): void => {
  const sheet = workbook.addWorksheet('Expense Splits');

  sheet.columns = [
    { header: 'Expense ID', key: 'id', width: 38 },
    { header: 'Date', key: 'date', width: 14, style: { numFmt: DATE_FMT } },
    { header: 'Title', key: 'title', width: 30 },
    { header: 'Total amount', key: 'amount', width: 15, style: { numFmt: MONEY_FMT } },
    { header: 'Participant', key: 'participant', width: 24 },
    { header: 'Share', key: 'share', width: 14, style: { numFmt: MONEY_FMT } },
    { header: 'Is payer', key: 'isPayer', width: 10 },
  ];

  for (const expense of dataset.expenses) {
    for (const participant of expense.participants) {
      sheet.addRow({
        id: expense.id,
        date: asDate(expense.expenseDate),
        title: safeText(expense.title),
        amount: rupees(expense.amountPaise),
        participant: safeText(participant.fullName),
        share: rupees(participant.sharePaise),
        isPayer: participant.isPayer ? 'Yes' : 'No',
      });
    }
  }

  styleTable(sheet, 7);
};

/* -------------------------------------------------------------------------- */
/* Sheet 4 — Person-wise relationship                                         */
/* -------------------------------------------------------------------------- */

const buildRelationshipSheet = (workbook: ExcelJS.Workbook, dataset: ExportDataset): void => {
  const sheet = workbook.addWorksheet('Person-wise Relationship');

  sheet.columns = [
    { header: 'Person', key: 'person', width: 24 },
    { header: 'I paid for them', key: 'iPaid', width: 18, style: { numFmt: MONEY_FMT } },
    { header: 'They paid for me', key: 'theyPaid', width: 18, style: { numFmt: MONEY_FMT } },
    { header: 'I currently owe', key: 'iOwe', width: 18, style: { numFmt: MONEY_FMT } },
    { header: 'They currently owe', key: 'theyOwe', width: 19, style: { numFmt: MONEY_FMT } },
    { header: 'Shared expenses', key: 'count', width: 16 },
    { header: 'Last shared expense', key: 'last', width: 20, style: { numFmt: DATE_FMT } },
    { header: 'Still a member', key: 'member', width: 15 },
  ];

  for (const row of dataset.report.relationships) {
    sheet.addRow({
      person: safeText(row.person.fullName),
      iPaid: rupees(row.iPaidForThem.paise),
      theyPaid: rupees(row.theyPaidForMe.paise),
      iOwe: rupees(row.iCurrentlyOwe.paise),
      theyOwe: rupees(row.theyCurrentlyOwe.paise),
      count: row.relatedExpenseCount,
      last: asDate(row.lastRelatedExpenseDate),
      member: row.isStillMember ? 'Yes' : 'No',
    });
  }

  styleTable(sheet, 8);

  const note = sheet.addRow([]);
  note.getCell(1).value =
    'Historical attribution (columns B–C) is not the same as a current obligation (columns D–E). Paying for someone does not mean they still owe you.';
  note.getCell(1).font = { italic: true, color: { argb: 'FF64748B' } };
  sheet.mergeCells(`A${note.number}:H${note.number}`);
};

/* -------------------------------------------------------------------------- */
/* Sheet 5 — Settlements                                                      */
/* -------------------------------------------------------------------------- */

const buildSettlementsSheet = (workbook: ExcelJS.Workbook, dataset: ExportDataset): void => {
  const sheet = workbook.addWorksheet('Settlements');

  sheet.columns = [
    { header: 'Settlement ID', key: 'id', width: 38 },
    { header: 'Created', key: 'created', width: 22, style: { numFmt: DATETIME_FMT } },
    { header: 'Payer', key: 'payer', width: 22 },
    { header: 'Receiver', key: 'receiver', width: 22 },
    { header: 'Amount', key: 'amount', width: 14, style: { numFmt: MONEY_FMT } },
    { header: 'Method', key: 'method', width: 14 },
    { header: 'Status', key: 'status', width: 20 },
    { header: 'Affects balance', key: 'affects', width: 16 },
    { header: 'Paid at', key: 'paid', width: 22, style: { numFmt: DATETIME_FMT } },
    { header: 'Verified at', key: 'verified', width: 22, style: { numFmt: DATETIME_FMT } },
    { header: 'Proof', key: 'proof', width: 10 },
    { header: 'Note', key: 'note', width: 28 },
    { header: 'Rejection reason', key: 'reason', width: 30 },
  ];

  for (const settlement of dataset.settlements) {
    sheet.addRow({
      id: settlement.id,
      created: settlement.createdAt,
      payer: safeText(settlement.payerName),
      receiver: safeText(settlement.receiverName),
      amount: rupees(settlement.amountPaise),
      method: PAYMENT_LABELS[settlement.paymentMethod] ?? settlement.paymentMethod,
      status: STATUS_LABELS[settlement.status] ?? settlement.status,
      // Makes the "only completed settlements move money" rule legible in the file.
      affects: settlement.status === 'completed' ? 'Yes' : 'No',
      paid: settlement.paidAt,
      verified: settlement.verifiedAt,
      proof: settlement.hasProof ? 'Yes' : 'No',
      note: safeText(settlement.note),
      reason: safeText(settlement.rejectionReason),
    });
  }

  styleTable(sheet, 13);
};

/* -------------------------------------------------------------------------- */
/* Sheet 6 — Period breakdown                                                 */
/* -------------------------------------------------------------------------- */

const buildPeriodSheet = (workbook: ExcelJS.Workbook, dataset: ExportDataset): void => {
  const { report } = dataset;
  const sheet = workbook.addWorksheet('Period Breakdown');

  sheet.columns = [
    { header: 'Period', key: 'label', width: 18 },
    { header: 'Expenses', key: 'count', width: 12 },
    { header: 'Total expense', key: 'total', width: 16, style: { numFmt: MONEY_FMT } },
    { header: 'Paid by me', key: 'paid', width: 16, style: { numFmt: MONEY_FMT } },
    { header: 'My share', key: 'share', width: 16, style: { numFmt: MONEY_FMT } },
  ];

  for (const bucket of report.periodBreakdown) {
    sheet.addRow({
      label: safeText(bucket.label),
      count: bucket.expenseCount,
      total: rupees(bucket.totalExpensePaise),
      paid: rupees(bucket.paidByMePaise),
      share: rupees(bucket.mySharePaise),
    });
  }

  styleTable(sheet, 5);

  // Reconciliation row: these totals must match the Summary sheet exactly.
  const totalRow = sheet.addRow({
    label: 'TOTAL',
    count: report.periodBreakdown.reduce((sum, b) => sum + b.expenseCount, 0),
    total: rupees(report.periodBreakdown.reduce((sum, b) => sum + b.totalExpensePaise, 0)),
    paid: rupees(report.periodBreakdown.reduce((sum, b) => sum + b.paidByMePaise, 0)),
    share: rupees(report.periodBreakdown.reduce((sum, b) => sum + b.mySharePaise, 0)),
  });
  totalRow.font = { bold: true };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEAD_FILL } };
};

/* -------------------------------------------------------------------------- */

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'group';

export type GeneratedReport = { buffer: Buffer; filename: string };

/** Builds the six-sheet workbook. */
export const generateFinancialReport = async (
  dataset: ExportDataset,
  user: { fullName: string; email: string },
): Promise<GeneratedReport> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SplitWise';
  workbook.created = new Date();

  buildSummarySheet(workbook, dataset, user);
  buildExpensesSheet(workbook, dataset);
  buildSplitsSheet(workbook, dataset);
  buildRelationshipSheet(workbook, dataset);
  buildSettlementsSheet(workbook, dataset);
  buildPeriodSheet(workbook, dataset);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);

  return {
    buffer: Buffer.from(arrayBuffer),
    filename: `splitwise-${slugify(dataset.report.group.name)}-${stamp}.xlsx`,
  };
};
