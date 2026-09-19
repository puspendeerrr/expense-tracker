import { z } from 'zod';

/**
 * Group validation. Mirrors the auth schemas' conventions: parse rather than check, so
 * handlers receive trimmed, normalized, correctly typed data and can never reach a raw
 * client value.
 */

export const groupNameSchema = z
  .string({ required_error: 'Group name is required' })
  .trim()
  .min(2, 'Group name must be at least 2 characters')
  .max(60, 'Group name must be at most 60 characters');

export const groupDescriptionSchema = z
  .string()
  .trim()
  .max(280, 'Description must be at most 280 characters')
  .nullable()
  .optional();

export const createGroupSchema = z
  .object({
    name: groupNameSchema,
    description: groupDescriptionSchema,
  })
  .strict();

/**
 * A join credential is either a 6-character human code or an opaque share token.
 * Both arrive on the same field because the user pastes whatever they were given --
 * a code, a token, or a full /join/<token> URL. The service resolves which it is.
 */
export const inviteCredentialSchema = z
  .string({ required_error: 'Enter an invite code or link' })
  .trim()
  .min(1, 'Enter an invite code or link')
  .max(512, 'That invite value is too long')
  .transform((value) => {
    // Accept a pasted invite URL and pull the credential out of it.
    const match = /\/join\/([^/?#\s]+)/.exec(value);
    return match?.[1] ? decodeURIComponent(match[1]) : value;
  });

export const joinGroupSchema = z.object({ invite: inviteCredentialSchema }).strict();

export const paydaySchema = z
  .union([z.number(), z.string(), z.null()])
  .transform((value) => {
    if (value === null || value === '') return null;
    const parsed = typeof value === 'string' ? Number(value) : value;
    return parsed;
  })
  .refine(
    (value) => value === null || (Number.isInteger(value) && value >= 1 && value <= 31),
    { message: 'Payday must be a day of the month between 1 and 31' },
  );

export const setPaydaySchema = z.object({ payday: paydaySchema }).strict();

export const updateGroupSchema = z
  .object({
    name: groupNameSchema.optional(),
    description: groupDescriptionSchema,
  })
  .strict()
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'Provide at least one field to update',
  });

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
export type SetPaydayInput = z.infer<typeof setPaydaySchema>;

/** Activity feed paging. */
export const listActivitiesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .passthrough();
