import 'dotenv/config';
import { pool } from '../db/client.js';
import { env, isProduction } from '../config/env.js';
import { paiseToRupees, formatPaise } from '../utils/money.js';
import { connectMongoSource } from './mongoSource.js';
import { migrateGroup, verifyBalances, type MigrationReport } from './migrateGroup.js';

/**
 * CLI for migrating a group out of the legacy MongoDB database.
 *
 *   npm run migrate:group -- --code IOWUVL --dry-run
 *   npm run migrate:group -- --code IOWUVL
 *
 * The source database is only ever read. Re-running is safe: every migrated row carries
 * its legacy id, so a second run reports "existing" instead of duplicating.
 */

type Args = { code: string; dryRun: boolean; tzOffset: number; skipVerify: boolean };

const parseArgs = (argv: string[]): Args => {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  return {
    code: get('--code') ?? 'IOWUVL',
    dryRun: argv.includes('--dry-run'),
    tzOffset: Number(get('--tz-offset') ?? 330),
    skipVerify: argv.includes('--skip-verify'),
  };
};

const rule = (char = '─') => console.log(char.repeat(72));

const printReport = (report: MigrationReport): void => {
  rule('═');
  console.log(report.dryRun ? '  DRY RUN — nothing was written' : '  MIGRATION COMPLETE');
  rule('═');

  console.log(`\nGroup:  ${report.group?.name} (code ${report.group?.inviteCode})`);
  console.log(`        id ${report.group?.id}\n`);

  const line = (label: string, created: number, existing?: number, extra = '') =>
    console.log(
      `  ${label.padEnd(16)} created ${String(created).padStart(4)}` +
        (existing === undefined ? '' : `   already present ${String(existing).padStart(4)}`) +
        (extra ? `   ${extra}` : ''),
    );

  line('Users', report.users.created, report.users.linked ? undefined : 0,
    `linked to existing accounts ${report.users.linked}`);
  line('Members', report.members.created, report.members.existing);
  line('Expenses', report.expenses.created, report.expenses.existing,
    `value ${formatPaise(report.expenses.totalPaise)}`);
  line('Splits', report.participants.created);
  line('Settlements', report.settlements.created, report.settlements.existing);
  line('Activities', report.activities.created, report.activities.existing);
  line('Notifications', report.notifications.created, report.notifications.existing,
    `dangling refs ${report.notifications.danglingRefs}`);

  if (report.repairs.length > 0) {
    console.log(`\n  ${report.repairs.length} expense(s) had shares that did not add up and were repaired.`);
    console.log('  (Caused by the legacy edit path rounding each share independently.)\n');
    console.log('    drift   amount      title');
    for (const repair of report.repairs.slice(0, 40)) {
      const drift = `${repair.driftPaise > 0 ? '+' : ''}${repair.driftPaise}p`;
      console.log(
        `    ${drift.padStart(6)}  ${formatPaise(repair.amountPaise).padStart(10)}  ${repair.title.slice(0, 40)}`,
      );
    }
    if (report.repairs.length > 40) {
      console.log(`    … and ${report.repairs.length - 40} more`);
    }
  }

  if (report.warnings.length > 0) {
    console.log(`\n  WARNINGS (${report.warnings.length}):`);
    for (const warning of report.warnings.slice(0, 25)) console.log(`    - ${warning}`);
    if (report.warnings.length > 25) {
      console.log(`    … and ${report.warnings.length - 25} more`);
    }
  }
};

const run = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));

  if (isProduction && !process.env.ALLOW_PRODUCTION_MIGRATION) {
    console.error(
      '\nRefusing to run against a production target without ALLOW_PRODUCTION_MIGRATION=1.\n',
    );
    process.exit(1);
  }

  const sourceUri = env.SOURCE_MONGODB_URI;
  if (!sourceUri) {
    console.error(
      '\nSOURCE_MONGODB_URI is not set. Add the legacy Atlas connection string to server/.env.\n' +
        'It is read-only: this tool never writes to MongoDB.\n',
    );
    process.exit(1);
  }

  console.log(`\nSource : MongoDB Atlas (read-only)`);
  console.log(`Target : ${env.DATABASE_URL.replace(/\/\/([^:]+):[^@]*@/, '//$1:****@')}`);
  console.log(`Group  : invite code ${args.code}`);
  console.log(`Dates  : resolved at UTC${args.tzOffset >= 0 ? '+' : ''}${args.tzOffset / 60}h`);
  console.log(`Mode   : ${args.dryRun ? 'dry run' : 'WRITE'}\n`);

  const source = await connectMongoSource(sourceUri);

  try {
    const report = await migrateGroup({
      source,
      inviteCode: args.code,
      dryRun: args.dryRun,
      timezoneOffsetMinutes: args.tzOffset,
    });

    printReport(report);

    if (!args.dryRun && !args.skipVerify && report.group) {
      rule();
      console.log('  VERIFYING BALANCES against the source…\n');

      const check = await verifyBalances(source, args.code, report.group.id);
      const mismatches = check.rows.filter((row) => row.deltaPaise !== 0);

      console.log('    legacy      migrated    delta   debtor → creditor');
      for (const row of check.rows.slice(0, 30)) {
        const flag = row.deltaPaise === 0 ? ' ' : '!';
        console.log(
          `  ${flag} ${formatPaise(row.legacyPaise).padStart(11)} ${formatPaise(row.migratedPaise).padStart(11)} ` +
            `${String(row.deltaPaise).padStart(6)}p   ${row.debtor} → ${row.creditor}`,
        );
      }

      rule();
      if (mismatches.length === 0) {
        console.log('  ✓ Every pairwise debt matches the source exactly.');
      } else {
        const worst = Math.max(...mismatches.map((row) => Math.abs(row.deltaPaise)));
        console.log(
          `  ${mismatches.length} pair(s) differ, worst by ${worst} paise ` +
            `(${formatPaise(worst)}).`,
        );
        console.log(
          '  Differences of a few paise are the expected consequence of repairing the\n' +
            '  legacy splits that did not add up. Anything larger needs investigating.',
        );
      }
      rule();
    }

    if (args.dryRun) {
      console.log('\nNothing was written. Re-run without --dry-run to apply.\n');
    }
  } finally {
    await source.close();
    await pool.end();
  }
};

run().catch((error: unknown) => {
  console.error('\nMigration failed:', error instanceof Error ? error.message : error);
  if (error instanceof Error && error.stack) console.error(error.stack);
  process.exit(1);
});

export { paiseToRupees };
