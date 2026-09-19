import { describe, expect, it } from 'vitest';
import {
  classifyActivity,
  isBcryptHash,
  normaliseEmail,
  reconcileShares,
  toCalendarDate,
  toNotificationType,
  toPaise,
  toSettlementStatus,
} from '../src/migration/transform.js';

/**
 * Migration transform tests.
 *
 * These are the rules that decide whether migrated money is correct, so they are tested
 * directly rather than only through a end-to-end run against live data.
 */

describe('money conversion', () => {
  it('converts rupee floats to exact paise', () => {
    expect(toPaise(719)).toBe(71900);
    expect(toPaise(24.75)).toBe(2475);
    expect(toPaise(5.5)).toBe(550);
    expect(toPaise(0.01)).toBe(1);
    expect(toPaise(null)).toBe(0);
  });

  it('survives binary float representation error', () => {
    // 35.35 * 100 is 3534.9999... in IEEE-754; truncating would lose a paisa, so the
    // conversion rounds.
    expect(toPaise(35.35)).toBe(3535);
    expect(toPaise(0.07)).toBe(7);
    expect(toPaise(28824)).toBe(2882400);
  });

  it('does not invent precision a stored double never had', () => {
    /*
     * 1.005 cannot be represented exactly: the double actually stored is
     * 1.00499999999999989..., so 100 paise is the faithful reading of the source value.
     * Rounding up to 101 would fabricate a paisa that was never in the database.
     *
     * This only affects values with a third decimal place. Every amount in the migrated
     * data is a real currency figure entered to two decimals, so none are affected.
     */
    expect(1.005 * 100).toBeLessThan(100.5);
    expect(toPaise(1.005)).toBe(100);
  });
});

describe('share reconciliation', () => {
  it('leaves an already-balanced split untouched', () => {
    const result = reconcileShares(9900, [
      { userId: 'a', sharePaise: 2475 },
      { userId: 'b', sharePaise: 2475 },
      { userId: 'c', sharePaise: 2475 },
      { userId: 'd', sharePaise: 2475 },
    ]);

    expect(result.repaired).toBe(false);
    expect(result.driftPaise).toBe(0);
    expect(result.participants.map((p) => p.sharePaise)).toEqual([2475, 2475, 2475, 2475]);
  });

  it('repairs a split that sums over the amount', () => {
    // The real "Bus kiraya" case: ₹100 across 6, stored shares total 2 paise too much.
    const result = reconcileShares(10000, [
      { userId: 'a', sharePaise: 1667 },
      { userId: 'b', sharePaise: 1667 },
      { userId: 'c', sharePaise: 1667 },
      { userId: 'd', sharePaise: 1667 },
      { userId: 'e', sharePaise: 1667 },
      { userId: 'f', sharePaise: 1667 },
    ]);

    expect(result.repaired).toBe(true);
    expect(result.driftPaise).toBe(2);
    expect(result.participants.reduce((s, p) => s + p.sharePaise, 0)).toBe(10000);
  });

  it('repairs a split that sums under the amount', () => {
    const result = reconcileShares(18200, [
      { userId: 'a', sharePaise: 3033 },
      { userId: 'b', sharePaise: 3033 },
      { userId: 'c', sharePaise: 3033 },
      { userId: 'd', sharePaise: 3033 },
      { userId: 'e', sharePaise: 3033 },
      { userId: 'f', sharePaise: 3033 },
    ]);

    expect(result.driftPaise).toBe(-2);
    expect(result.participants.reduce((s, p) => s + p.sharePaise, 0)).toBe(18200);
  });

  it('never moves a share by more than necessary', () => {
    const before = [
      { userId: 'a', sharePaise: 3400 },
      { userId: 'b', sharePaise: 3300 },
      { userId: 'c', sharePaise: 3300 },
    ];
    const result = reconcileShares(10000, before.map((row) => ({ ...row })));

    for (const [index, row] of result.participants.entries()) {
      expect(Math.abs(row.sharePaise - before[index]!.sharePaise)).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic across runs', () => {
    const input = () => [
      { userId: 'zeta', sharePaise: 1667 },
      { userId: 'alpha', sharePaise: 1667 },
      { userId: 'mid', sharePaise: 1666 },
    ];
    const first = reconcileShares(5000, input());
    const second = reconcileShares(5000, input());
    expect(first.participants).toEqual(second.participants);
  });

  it('never produces a negative share', () => {
    const result = reconcileShares(1, [
      { userId: 'a', sharePaise: 0 },
      { userId: 'b', sharePaise: 3 },
    ]);
    expect(result.participants.every((p) => p.sharePaise >= 0)).toBe(true);
    expect(result.participants.reduce((s, p) => s + p.sharePaise, 0)).toBe(1);
  });
});

describe('calendar dates', () => {
  it('resolves an evening IST instant to the correct local day', () => {
    // 2026-08-11T19:30:00Z is 01:00 on the 12th in IST.
    expect(toCalendarDate(new Date('2026-08-11T19:30:00Z'))).toBe('2026-08-12');
    // Reading the UTC date would wrongly give the 11th.
    expect(toCalendarDate(new Date('2026-08-11T19:30:00Z'), 0)).toBe('2026-08-11');
  });

  it('keeps a midday instant on the same day', () => {
    expect(toCalendarDate(new Date('2026-08-11T09:00:00Z'))).toBe('2026-08-11');
  });
});

describe('enum mapping', () => {
  it('maps retired legacy settlement statuses', () => {
    expect(toSettlementStatus('verification_pending')).toBe('paid_pending_approval');
    expect(toSettlementStatus('expired')).toBe('cancelled');
    expect(toSettlementStatus('completed')).toBe('completed');
    expect(toSettlementStatus('will_pay_soon')).toBe('will_pay_soon');
  });

  it('maps notification types', () => {
    expect(toNotificationType('expense_added')).toBe('expense_added');
    expect(toNotificationType('group_member_joined')).toBe('member_joined');
    expect(toNotificationType('settlement_approved')).toBe('settlement_approved');
  });

  it('classifies the legacy activity sentences actually present in the data', () => {
    expect(classifyActivity('created group "Survivor\'s (Flatmates)"')).toBe('group_created');
    expect(classifyActivity('joined the group')).toBe('member_joined');
    expect(classifyActivity('added "Dahi" ₹70')).toBe('expense_created');
    expect(classifyActivity('updated expense "Rice"')).toBe('expense_updated');
    expect(classifyActivity('deleted expense "Milk"')).toBe('expense_deleted');
    expect(classifyActivity('marked ₹40.00 as paid in cash to Dikshu')).toBe(
      'settlement_created',
    );
    expect(classifyActivity('paid ₹100 via UPI to Vishal (proof attached)')).toBe(
      'settlement_created',
    );
    expect(classifyActivity('promised to pay ₹50 to Aman soon')).toBe('settlement_created');
    expect(classifyActivity('approved ₹40.00 cash payment from Vishal')).toBe(
      'settlement_approved',
    );
    expect(classifyActivity('rejected ₹20 payment from Satyawan: "wrong amount"')).toBe(
      'settlement_rejected',
    );
    expect(classifyActivity('set group payday to day 8 of every month')).toBe('payday_updated');
    expect(classifyActivity('regenerated group QR invite code')).toBe('invite_regenerated');
  });
});

describe('identity', () => {
  it('normalises emails the way the auth system stores them', () => {
    expect(normaliseEmail('  Chaten.Toor@Gmail.COM ')).toBe('chaten.toor@gmail.com');
  });

  it('recognises reusable bcrypt hashes', () => {
    expect(isBcryptHash('$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')).toBe(
      true,
    );
    expect(isBcryptHash('$2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')).toBe(
      true,
    );
    expect(isBcryptHash('plaintext')).toBe(false);
    expect(isBcryptHash(undefined)).toBe(false);
  });
});
