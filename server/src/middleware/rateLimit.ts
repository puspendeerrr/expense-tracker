import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES, tooManyRequests } from '../utils/errors.js';

export type RateLimitHit = { allowed: boolean; remaining: number; resetAt: number };

/**
 * Storage seam for the limiter.
 *
 * The in-memory implementation below is correct for the single-server setup this
 * project targets. Moving to multiple instances means swapping this one interface
 * (for a Postgres-backed or Redis-backed store) and nothing else.
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number, max: number): RateLimitHit;
  reset(key: string): void;
  clear(): void;
}

type Bucket = { count: number; resetAt: number };

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();
  private readonly sweeper: NodeJS.Timeout;

  constructor() {
    // Bounded memory: expired buckets are dropped every minute.
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref?.();
  }

  hit(key: string, windowMs: number, max: number): RateLimitHit {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      const resetAt = now + windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: max - 1, resetAt };
    }

    bucket.count += 1;
    return {
      allowed: bucket.count <= max,
      remaining: Math.max(0, max - bucket.count),
      resetAt: bucket.resetAt,
    };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  clear(): void {
    this.buckets.clear();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

export const rateLimitStore: RateLimitStore = new MemoryRateLimitStore();

export type RateLimitOptions = {
  /** Namespace, so two limiters never share a bucket. */
  name: string;
  windowMs: number;
  max: number;
  /**
   * Extra key dimension beyond the client IP. Email-keyed limits stop one attacker
   * from spraying a single victim's address from many IPs; IP-keyed limits stop one
   * host from spraying many addresses. Most endpoints want both, hence two limiters.
   */
  keyBy?: (req: Request) => string | undefined;
  message?: string;
};

const clientIp = (req: Request): string => req.ip ?? req.socket.remoteAddress ?? 'unknown';

export const rateLimit = (options: RateLimitOptions) => {
  const { name, windowMs, max, keyBy, message } = options;

  return (req: Request, _res: Response, next: NextFunction): void => {
    const extra = keyBy?.(req);
    // A missing extra key falls back to IP-only rather than collapsing every caller
    // into one shared bucket.
    const key = `${name}:${extra ? `k=${extra}` : `ip=${clientIp(req)}`}`;
    const result = rateLimitStore.hit(key, windowMs, max);

    if (!result.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
      next(
        tooManyRequests(
          ERROR_CODES.RATE_LIMITED,
          message ?? 'Too many requests. Please try again shortly.',
          { retryAfterSeconds, resetAt: new Date(result.resetAt).toISOString() },
        ),
      );
      return;
    }

    next();
  };
};

/** Reads the normalized email out of an already-parsed body, for email-keyed limits. */
export const emailKey = (req: Request): string | undefined => {
  const value = (req.body as { email?: unknown } | undefined)?.email;
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : undefined;
};
