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

/**
 * Group imagery.
 *
 * The browser uploads straight to Cloudinary with an unsigned preset, so what reaches
 * the server is the result of that upload rather than the bytes. That means the URL is
 * attacker-controllable and has to be constrained here: an unchecked string would let
 * someone point a group's avatar at any host, turning every member's dashboard into a
 * request to a server of their choosing.
 *
 * Sending `null` for both fields removes the image; sending one without the other is
 * rejected, because a URL with no public id can never be cleaned up afterwards.
 */
const cloudinaryUrlSchema = z
  .string()
  .trim()
  .url()
  .max(600)
  .refine((value) => /^https:\/\/res\.cloudinary\.com\//.test(value), {
    message: 'Images must be hosted on Cloudinary',
  });

const publicIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .regex(/^[\w\-./]+$/, 'Invalid image reference');

const mediaPairSchema = z
  .object({
    url: cloudinaryUrlSchema.nullable(),
    publicId: publicIdSchema.nullable(),
  })
  .strict()
  .refine((data) => (data.url === null) === (data.publicId === null), {
    message: 'Provide both the URL and the public id, or null for both',
  });

export const groupMediaSchema = z
  .object({
    avatar: mediaPairSchema.optional(),
    cover: mediaPairSchema.optional(),
  })
  .strict()
  .refine((data) => data.avatar !== undefined || data.cover !== undefined, {
    message: 'Provide an avatar or a cover to change',
  });

export type GroupMediaInput = z.infer<typeof groupMediaSchema>;

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
export type SetPaydayInput = z.infer<typeof setPaydaySchema>;

/**
 * Activity feed paging and filters.
 *
 * Filtering happens on the server rather than over the fetched page. A feed is paged,
 * so narrowing one page in the browser would show "3 results" when the group holds
 * thirty matching entries further down -- an answer that is not merely incomplete but
 * wrong, and indistinguishable from the truth at the call site.
 */
export const listActivitiesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    offset: z.coerce.number().int().min(0).default(0),
    search: z.string().trim().max(100).optional(),
    type: z.string().trim().max(50).optional(),
    actorId: z.string().uuid().optional(),
    from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .passthrough();
