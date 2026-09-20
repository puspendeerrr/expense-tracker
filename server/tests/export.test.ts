import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { api, closeDatabase, resetAll, signupUser } from './helpers.js';
import { joinGroupByInvite } from '../src/services/groupService.js';
import { createExpense } from '../src/services/expenseService.js';
import { approveSettlement, createSettlement } from '../src/services/settlementService.js';
import { rupeesToPaise } from '../src/utils/money.js';

beforeEach(resetAll);
afterAll(closeDatabase);

const dayOffset = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const TODAY = dayOffset(0);

const member = async (name: string) => {
  const { cookie, userId } = await signupUser(`${name}@example.com`, undefined, name);
  return { cookie, userId, name };
};

const setup = async (count = 3) => {
  const people = [];
  for (let i = 0; i < count; i += 1) people.push(await member(`user${i}`));

  const res = await api()
    .post('/api/groups')
    .set('Cookie', people[0]!.cookie)
    .send({ name: 'Flat 402' })
    .expect(201);

  const group = res.body.data.group as { id: string; inviteCode: string };
  for (let i = 1; i < count; i += 1) await joinGroupByInvite(group.inviteCode, people[i]!.userId);

  return { groupId: group.id, people };
};

const spend = (
  groupId: string,
  paidBy: string,
  rupees: number,
  opts: { title?: string; date?: string; participantIds?: string[]; notes?: string } = {},
) =>
  createExpense({
    groupId,
    actorUserId: paidBy,
    title: opts.title ?? `Expense ${rupees}`,
    amountPaise: rupeesToPaise(rupees)!,
    paidBy,
    splitType: opts.participantIds ? 'specific' : 'everyone',
    participantIds: opts.participantIds,
    paymentMode: 'cash',
    expenseDate: opts.date ?? TODAY,
    notes: opts.notes ?? '',
  });

/** Downloads the workbook and parses it back with ExcelJS. */
const downloadWorkbook = async (
  cookie: string,
  groupId: string,
  query: Record<string, string> = {},
) => {
  const params = new URLSearchParams(query).toString();
  const res = await api()
    .get(`/api/groups/${groupId}/reports/export${params ? `?${params}` : ''}`)
    .set('Cookie', cookie)
    .buffer(true)
    .parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => callback(null, Buffer.concat(chunks) as unknown as Buffer));
    })
    .expect(200);

  const workbook = new ExcelJS.Workbook();
  // ExcelJS declares its own Buffer type; bridge it explicitly rather than via `any`.
  await workbook.xlsx.load(res.body as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return { res, workbook };
};

const cellText = (sheet: ExcelJS.Worksheet, label: string): unknown => {
  let found: unknown;
  sheet.eachRow((row) => {
    if (String(row.getCell(1).value ?? '').trim() === label) found = row.getCell(2).value;
  });
  return found;
};

/* ========================================================================== */

describe('excel export', () => {
  it('returns a real xlsx with all six sheets and download headers', async () => {
    const { groupId, people } = await setup(3);
    await spend(groupId, people[0]!.userId, 900);

    const { res, workbook } = await downloadWorkbook(people[0]!.cookie, groupId);

    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="splitmoney-flat-402-\d{4}-\d{2}-\d{2}\.xlsx"/,
    );
    expect(res.headers['access-control-expose-headers']).toContain('Content-Disposition');

    expect(workbook.worksheets.map((s) => s.name)).toEqual([
      'Summary',
      'Expenses',
      'Expense Splits',
      'Person-wise Relationship',
      'Settlements',
      'Period Breakdown',
    ]);
  });

  it('reconciles the workbook against the dashboard to the paisa', async () => {
    const { groupId, people } = await setup(3);
    const [alice, bob] = people as [typeof people[0], typeof people[0]];

    await spend(groupId, alice.userId, 900);
    await spend(groupId, bob.userId, 300.03);
    await spend(groupId, alice.userId, 250, {
      participantIds: [alice.userId, bob.userId],
    });

    const dashboard = await api()
      .get(`/api/groups/${groupId}/reports/dashboard?scope=analytics`)
      .set('Cookie', alice.cookie)
      .expect(200);

    const { workbook } = await downloadWorkbook(alice.cookie, groupId);
    const summary = workbook.getWorksheet('Summary')!;

    const expected = dashboard.body.data.periodSummary;
    expect(cellText(summary, 'Total expense value')).toBeCloseTo(
      expected.totalExpense.rupees,
      2,
    );
    expect(cellText(summary, 'Total paid by me')).toBeCloseTo(expected.totalPaidByMe.rupees, 2);
    expect(cellText(summary, 'My total share')).toBeCloseTo(expected.myShare.rupees, 2);
    expect(cellText(summary, 'Paid for others')).toBeCloseTo(expected.paidForOthers.rupees, 2);
    expect(cellText(summary, 'Expenses (count)')).toBe(expected.expenseCount);
  });

  it('splits sheet reconciles each expense to its total', async () => {
    const { groupId, people } = await setup(3);
    await spend(groupId, people[0]!.userId, 1000, { title: 'Three way' });

    const { workbook } = await downloadWorkbook(people[0]!.cookie, groupId);
    const splits = workbook.getWorksheet('Expense Splits')!;

    let shareTotal = 0;
    let expenseTotal = 0;
    splits.eachRow((row, index) => {
      if (index === 1) return; // header
      shareTotal += Number(row.getCell(6).value ?? 0);
      expenseTotal = Number(row.getCell(4).value ?? 0);
    });

    // Three rows of 333.34 / 333.33 / 333.33 must total exactly 1000.00.
    expect(Math.round(shareTotal * 100)).toBe(100000);
    expect(expenseTotal).toBe(1000);
  });

  it('period breakdown total row reconciles with the summary', async () => {
    const { groupId, people } = await setup(2);
    await spend(groupId, people[0]!.userId, 100, { date: dayOffset(-2) });
    await spend(groupId, people[0]!.userId, 200, { date: dayOffset(-1) });
    await spend(groupId, people[0]!.userId, 300, { date: TODAY });

    const { workbook } = await downloadWorkbook(people[0]!.cookie, groupId);
    const period = workbook.getWorksheet('Period Breakdown')!;
    const summary = workbook.getWorksheet('Summary')!;

    let totalRowValue: number | null = null;
    period.eachRow((row) => {
      if (String(row.getCell(1).value ?? '') === 'TOTAL') {
        totalRowValue = Number(row.getCell(3).value ?? 0);
      }
    });

    expect(totalRowValue).toBe(600);
    expect(cellText(summary, 'Total expense value')).toBe(600);
  });

  it('honours the dashboard filters', async () => {
    const { groupId, people } = await setup(2);
    const alice = people[0]!;

    await spend(groupId, alice.userId, 100, { date: dayOffset(-30), title: 'Old' });
    await spend(groupId, alice.userId, 500, { date: TODAY, title: 'Recent' });

    const { workbook } = await downloadWorkbook(alice.cookie, groupId, {
      from: TODAY,
      to: TODAY,
    });

    const expenses = workbook.getWorksheet('Expenses')!;
    const titles: string[] = [];
    expenses.eachRow((row, index) => {
      if (index > 1) titles.push(String(row.getCell(3).value ?? ''));
    });

    expect(titles).toEqual(['Recent']);
    expect(cellText(workbook.getWorksheet('Summary')!, 'Total expense value')).toBe(500);
  });

  it('marks which settlements actually affect a balance', async () => {
    const { groupId, people } = await setup(2);
    const [alice, bob] = people as [typeof people[0], typeof people[0]];

    await spend(groupId, alice.userId, 1000);

    const approved = await createSettlement({
      groupId, payerId: bob.userId, receiverId: alice.userId, amountPaise: 20000,
      paymentMethod: 'cash', actionType: 'payment',
    });
    await approveSettlement(approved.id, groupId, alice.userId);

    await createSettlement({
      groupId, payerId: bob.userId, receiverId: alice.userId, amountPaise: 10000,
      paymentMethod: 'cash', actionType: 'will_pay_soon',
    });

    const { workbook } = await downloadWorkbook(alice.cookie, groupId);
    const sheet = workbook.getWorksheet('Settlements')!;

    const rows: { status: string; affects: string }[] = [];
    sheet.eachRow((row, index) => {
      if (index === 1) return;
      rows.push({
        status: String(row.getCell(7).value ?? ''),
        affects: String(row.getCell(8).value ?? ''),
      });
    });

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.status === 'Completed')?.affects).toBe('Yes');
    expect(rows.find((r) => r.status === 'Will pay soon')?.affects).toBe('No');
  });

  it('keeps historical attribution separate from current obligation', async () => {
    const { groupId, people } = await setup(2);
    const [alice, bob] = people as [typeof people[0], typeof people[0]];

    await spend(groupId, alice.userId, 2000);
    const settlement = await createSettlement({
      groupId, payerId: bob.userId, receiverId: alice.userId, amountPaise: 100000,
      paymentMethod: 'cash', actionType: 'payment',
    });
    await approveSettlement(settlement.id, groupId, alice.userId);

    const { workbook } = await downloadWorkbook(alice.cookie, groupId);
    const sheet = workbook.getWorksheet('Person-wise Relationship')!;

    let row: ExcelJS.Row | undefined;
    sheet.eachRow((candidate, index) => {
      if (index > 1 && String(candidate.getCell(1).value ?? '') === 'user1') row = candidate;
    });

    expect(row).toBeDefined();
    expect(Number(row!.getCell(2).value)).toBe(1000); // I paid for them — history stands
    expect(Number(row!.getCell(5).value)).toBe(0); // they currently owe — settled
  });

  it('neutralises spreadsheet formula injection', async () => {
    const { groupId, people } = await setup(2);
    await spend(groupId, people[0]!.userId, 100, {
      title: '=HYPERLINK("http://evil.test","click")',
      notes: '+1234',
    });

    const { workbook } = await downloadWorkbook(people[0]!.cookie, groupId);
    const sheet = workbook.getWorksheet('Expenses')!;

    let title = '';
    let notes = '';
    sheet.eachRow((row, index) => {
      if (index === 2) {
        title = String(row.getCell(3).value ?? '');
        notes = String(row.getCell(12).value ?? '');
      }
    });

    // Leading apostrophe forces the cell to be read as text, never evaluated.
    expect(title.startsWith("'=")).toBe(true);
    expect(notes.startsWith("'+")).toBe(true);
  });

  it('produces a valid workbook for an empty group', async () => {
    const { groupId, people } = await setup(2);

    const { workbook } = await downloadWorkbook(people[0]!.cookie, groupId);
    expect(workbook.worksheets).toHaveLength(6);
    expect(cellText(workbook.getWorksheet('Summary')!, 'Total expense value')).toBe(0);
    expect(cellText(workbook.getWorksheet('Summary')!, 'Largest expense')).toBe('None');
  });

  it('blocks a non-member from exporting', async () => {
    const { groupId } = await setup(2);
    const mallory = await member('mallory');

    await api()
      .get(`/api/groups/${groupId}/reports/export`)
      .set('Cookie', mallory.cookie)
      .expect(404);
  });
});

/* ========================================================================== */
/* Export builder: several people, and sheet selection                        */
/* ========================================================================== */

describe('export scoping', () => {
  /** Titles in the Expenses sheet, so a filter can be checked against real rows. */
  const expenseTitles = (workbook: ExcelJS.Workbook): string[] => {
    const sheet = workbook.getWorksheet('Expenses');
    if (!sheet) return [];
    const titles: string[] = [];
    sheet.eachRow((row, index) => {
      // Row 1 is the header.
      if (index === 1) return;
      const value = row.values as unknown[];
      for (const cell of value) {
        if (typeof cell === 'string' && cell.startsWith('E-')) titles.push(cell);
      }
    });
    return titles;
  };

  /**
   * Three people, one expense each, each involving only its payer, so every expense
   * belongs to exactly one person and a filter's effect is unambiguous.
   */
  const scoped = async () => {
    const { groupId, people } = await setup(3);
    await spend(groupId, people[0]!.userId, 100, {
      title: 'E-alpha',
      participantIds: [people[0]!.userId],
    });
    await spend(groupId, people[1]!.userId, 200, {
      title: 'E-bravo',
      participantIds: [people[1]!.userId],
    });
    await spend(groupId, people[2]!.userId, 300, {
      title: 'E-charlie',
      participantIds: [people[2]!.userId],
    });
    return { groupId, people };
  };

  it('includes everything when no people are named', async () => {
    const { groupId, people } = await scoped();
    const { workbook } = await downloadWorkbook(people[0]!.cookie, groupId);
    expect(expenseTitles(workbook).sort()).toEqual(['E-alpha', 'E-bravo', 'E-charlie']);
  });

  it('narrows to a single person', async () => {
    const { groupId, people } = await scoped();
    const { workbook } = await downloadWorkbook(people[0]!.cookie, groupId, {
      memberIds: people[1]!.userId,
    });
    expect(expenseTitles(workbook)).toEqual(['E-bravo']);
  });

  it('narrows to two people, and to neither of the others', async () => {
    const { groupId, people } = await scoped();
    const { workbook } = await downloadWorkbook(people[0]!.cookie, groupId, {
      memberIds: `${people[0]!.userId},${people[2]!.userId}`,
    });
    expect(expenseTitles(workbook).sort()).toEqual(['E-alpha', 'E-charlie']);
  });

  it('ignores a repeated id rather than double-counting the rows', async () => {
    const { groupId, people } = await scoped();
    const { workbook } = await downloadWorkbook(people[0]!.cookie, groupId, {
      memberIds: `${people[1]!.userId},${people[1]!.userId}`,
    });
    expect(expenseTitles(workbook)).toEqual(['E-bravo']);
  });

  it('rejects an id that is not a UUID', async () => {
    const { groupId, people } = await scoped();
    await api()
      .get(`/api/groups/${groupId}/reports/export?memberIds=not-a-uuid`)
      .set('Cookie', people[0]!.cookie)
      .expect(400);
  });

  it('rejects an empty people list', async () => {
    const { groupId, people } = await scoped();
    await api()
      .get(`/api/groups/${groupId}/reports/export?memberIds=`)
      .set('Cookie', people[0]!.cookie)
      .expect(400);
  });

  it('builds only the requested sheets', async () => {
    const { groupId, people } = await scoped();

    const { workbook } = await downloadWorkbook(people[0]!.cookie, groupId, {
      sections: 'expenses',
    });
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Expenses']);

    const both = await downloadWorkbook(people[0]!.cookie, groupId, {
      sections: 'summary,settlements',
    });
    expect(both.workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Summary',
      'Settlements',
    ]);
  });

  it('keeps the sheet order fixed regardless of the order requested', async () => {
    const { groupId, people } = await scoped();
    const { workbook } = await downloadWorkbook(people[0]!.cookie, groupId, {
      sections: 'settlements,summary',
    });
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Summary', 'Settlements']);
  });

  it('rejects an unknown sheet name and an empty selection', async () => {
    const { groupId, people } = await scoped();

    await api()
      .get(`/api/groups/${groupId}/reports/export?sections=payroll`)
      .set('Cookie', people[0]!.cookie)
      .expect(400);

    await api()
      .get(`/api/groups/${groupId}/reports/export?sections=`)
      .set('Cookie', people[0]!.cookie)
      .expect(400);
  });

  it('still rejects a range that runs backwards', async () => {
    const { groupId, people } = await scoped();
    await api()
      .get(
        `/api/groups/${groupId}/reports/export?from=${dayOffset(5)}&to=${dayOffset(-5)}`,
      )
      .set('Cookie', people[0]!.cookie)
      .expect(400);
  });

  it('does not let a non-member export the group', async () => {
    const { groupId } = await scoped();
    const outsider = await member('outsider');

    await api()
      .get(`/api/groups/${groupId}/reports/export`)
      .set('Cookie', outsider.cookie)
      .expect(404);
  });

  it('ignores a groupId in the query and exports the group in the path', async () => {
    const { groupId, people } = await scoped();

    const other = await api()
      .post('/api/groups')
      .set('Cookie', people[1]!.cookie)
      .send({ name: 'Other' })
      .expect(201);

    const { workbook } = await downloadWorkbook(people[0]!.cookie, groupId, {
      groupId: other.body.data.group.id as string,
    });

    // Three expenses means it read Flat 402, not the empty group named in the query.
    expect(expenseTitles(workbook)).toHaveLength(3);
  });
});
