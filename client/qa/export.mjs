import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { signedInContext, BASE } from './session.mjs';

/**
 * Export builder QA.
 *
 * Drives the dialog and then reads the produced workbook's own bytes, because the only
 * thing that matters is what lands on disk: a dialog that collects a person selection
 * and then downloads the whole group is worse than no dialog.
 */

await mkdir('qa/screenshots', { recursive: true });

const failures = [];
const browser = await chromium.launch({ downloadsPath: 'qa/downloads' });
const { context, page } = await signedInContext(browser, { width: 1280, height: 900 });

page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

/* ---- 1. The button opens a dialog rather than downloading ---- */

await page.locator('button[aria-label="Export to Excel"]').click();
await page.waitForTimeout(600);

const dialogTitle = await page.locator('[role="dialog"]').innerText().catch(() => '');
console.log('dialog opened:', /export to excel/i.test(dialogTitle));
if (!/export to excel/i.test(dialogTitle)) failures.push('Export did not open a dialog');

await page.screenshot({ path: 'qa/screenshots/export-dialog.png' });

/* ---- 2. Validation blocks an impossible request ---- */

await page.locator('button[aria-label="Period to export"]').click();
await page.waitForTimeout(300);
await page.locator('[role="option"]', { hasText: 'Custom range' }).click();
await page.waitForTimeout(400);

const downloadBtn = page.locator('button', { hasText: 'Download .xlsx' });
let disabled = await downloadBtn.isDisabled();
console.log('blocked on an incomplete custom range:', disabled);
if (!disabled) failures.push('custom range with no dates was not blocked');

// Back to all time.
await page.locator('button[aria-label="Period to export"]').click();
await page.waitForTimeout(300);
await page.locator('[role="option"]', { hasText: 'Everything' }).click();
await page.waitForTimeout(400);

// Clearing every sheet must block too.
await page.locator('button', { hasText: 'Clear all' }).click();
await page.waitForTimeout(300);
disabled = await downloadBtn.isDisabled();
console.log('blocked with no sheets selected:', disabled);
if (!disabled) failures.push('empty sheet selection was not blocked');
await page.locator('button', { hasText: 'Select all' }).click();
await page.waitForTimeout(300);

/* ---- 3. Pick two people and download ---- */

await page.locator('button', { hasText: 'Pick people' }).click();
await page.waitForTimeout(400);

const checkboxes = page.locator('[role="dialog"] [role="checkbox"]');
const total = await checkboxes.count();
console.log('selectable rows in the dialog:', total);

// The first two entries in the people list.
await checkboxes.nth(0).click();
await page.waitForTimeout(200);
await checkboxes.nth(1).click();
await page.waitForTimeout(300);

const summary = await page.locator('[role="dialog"]').innerText();
const says2 = /2 people/.test(summary);
console.log('summary reports 2 people:', says2);
if (!says2) failures.push('summary did not report the two selected people');

const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  downloadBtn.click(),
]);

const name = download.suggestedFilename();
const savedPath = 'qa/downloads/two-people.xlsx';
await download.saveAs(savedPath);
console.log('downloaded:', name);
if (!/\.xlsx$/.test(name)) failures.push(`unexpected filename: ${name}`);

const { readFile } = await import('node:fs/promises');
const bytes = await readFile(savedPath);
console.log('file size:', bytes.length, 'bytes');
if (bytes.length < 2000) failures.push(`workbook is implausibly small (${bytes.length} bytes)`);
// xlsx is a zip: "PK\x03\x04".
if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) failures.push('downloaded file is not a zip/xlsx');

/* ---- 4. Only the requested sheets are present ---- */

await page.locator('button[aria-label="Export to Excel"]').click();
await page.waitForTimeout(600);
await page.locator('button', { hasText: 'Clear all' }).click();
await page.waitForTimeout(200);
// Just "Expenses".
await page.locator('[role="dialog"] label', { hasText: 'Expenses' }).first().click();
await page.waitForTimeout(300);

const [single] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.locator('button', { hasText: 'Download .xlsx' }).click(),
]);
const singleSaved = 'qa/downloads/expenses-only.xlsx';
await single.saveAs(singleSaved);

// Sheet names live in a compressed entry inside the xlsx zip, so they have to be read
// with a real reader rather than grepped out of the bytes.
const ExcelJS = (await import('file:///D:/Web Dev/SplitWise/server/node_modules/exceljs/excel.js'))
  .default;

const readSheets = async (file) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  return workbook.worksheets.map((sheet) => sheet.name);
};

const allSheets = await readSheets(savedPath);
const oneSheet = await readSheets(singleSaved);
console.log('full export sheets:', allSheets.join(', '));
console.log('single-sheet export sheets:', oneSheet.join(', '));

if (allSheets.length < 6) failures.push(`full export produced only ${allSheets.length} sheets`);
if (!oneSheet.includes('Expenses')) failures.push('requested Expenses sheet is missing');
if (oneSheet.includes('Settlements')) failures.push('unrequested Settlements sheet was included');
if (oneSheet.length !== 1) failures.push(`expected exactly one sheet, got ${oneSheet.length}`);

/* ---- 5. Mobile ---- */

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.locator('button[aria-label="Export to Excel"]').click();
await page.waitForTimeout(700);
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
console.log('mobile overflow:', overflow);
if (overflow > 0) failures.push(`mobile overflow ${overflow}px`);
await page.screenshot({ path: 'qa/screenshots/export-dialog-390.png' });

await context.close();
await browser.close();

console.log('\nFAILURES:', failures.length);
for (const f of failures) console.log(' -', f);
process.exit(failures.length ? 1 : 0);
