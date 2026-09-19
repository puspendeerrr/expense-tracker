import { z } from 'zod';
import { amountSchema } from './expenseSchemas.js';

const uuidSchema = z.string().uuid('Invalid id');

/**
 * Settlement validation.
 *
 * Note what is deliberately NOT validated here: whether the amount is within the live
 * debt. That is a domain rule requiring a balance lookup, so it lives in the settlement
 * service where it can be enforced against the authoritative engine.
 */
export const createSettlementSchema = z
  .object({
    groupId: uuidSchema.optional(),
    receiverId: uuidSchema,
    amount: amountSchema,
    paymentMethod: z.enum(['cash', 'upi']).default('upi'),
    /** `will_pay_soon` records an intention, never a payment. */
    actionType: z.enum(['payment', 'will_pay_soon']).default('payment'),
    proofUrl: z.string().trim().max(1024).nullable().optional(),
    proofStorageKey: z.string().trim().max(512).nullable().optional(),
    note: z.string().trim().max(300).optional(),
  })
  .strict();

export const rejectSettlementSchema = z
  .object({
    groupId: uuidSchema.optional(),
    rejectionReason: z.string().trim().max(300).optional(),
  })
  .strict();

export const reuploadProofSchema = z
  .object({
    groupId: uuidSchema.optional(),
    proofUrl: z.string().trim().min(1, 'Payment proof is required').max(1024),
    proofStorageKey: z.string().trim().max(512).nullable().optional(),
  })
  .strict();

export const cancelSettlementSchema = z
  .object({ groupId: uuidSchema.optional() })
  .strict();

export const listSettlementsQuerySchema = z
  .object({
    status: z
      .enum(['all', 'paid_pending_approval', 'will_pay_soon', 'completed', 'rejected', 'cancelled'])
      .default('all'),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .passthrough();

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
