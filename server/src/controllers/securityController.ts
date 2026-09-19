import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendOk } from '../utils/http.js';
import { validated, validatedQuery } from '../middleware/validate.js';
import { clearSessionCookie } from '../services/sessionService.js';
import * as securityService from '../services/securityService.js';

/**
 * Account security endpoints.
 *
 * Every handler scopes to `req.user.id`. There is no path or body parameter naming a
 * user anywhere in this file, which is what makes it impossible to address another
 * account's sessions or history through these routes -- rather than relying on a check
 * that could be forgotten on a future endpoint.
 */

export const eventQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
    scope: z.enum(['all', 'logins']).default('all'),
  })
  .passthrough();

export const renameDeviceSchema = z
  .object({
    /**
     * Null clears the name and returns the row to its derived label. A blank string is
     * rejected rather than silently treated as null, because "saved an empty name" and
     * "removed the name" are different intentions and only one of them is an accident.
     */
    name: z.string().trim().min(1).max(60).nullable(),
  })
  .strict();

/** Live sessions for this account, with the caller's own marked. */
export const listDevices = async (req: Request, res: Response): Promise<void> => {
  const devices = await securityService.listDevices(req.user!.id, req.sessionId ?? '');
  sendOk(res, { devices });
};

export const renameDevice = async (req: Request, res: Response): Promise<void> => {
  const { name } = validated(req, renameDeviceSchema);
  await securityService.renameDevice(req.user!.id, String(req.params.sessionId), name);

  const devices = await securityService.listDevices(req.user!.id, req.sessionId ?? '');
  sendOk(res, { devices });
};

/**
 * Signs one device out.
 *
 * Revoking your own session is allowed and is treated as a logout: the cookie is
 * cleared so the browser is not left holding a token the server has already rejected.
 */
export const revokeDevice = async (req: Request, res: Response): Promise<void> => {
  const { revokedSelf } = await securityService.revokeOwnSession(
    req.user!.id,
    String(req.params.sessionId),
    req.sessionId ?? '',
  );

  if (revokedSelf) {
    clearSessionCookie(res);
    sendOk(res, { devices: [], signedOut: true });
    return;
  }

  const devices = await securityService.listDevices(req.user!.id, req.sessionId ?? '');
  sendOk(res, { devices, signedOut: false });
};

/** Signs out every device except the one making the request. */
export const revokeOtherDevices = async (req: Request, res: Response): Promise<void> => {
  const count = await securityService.revokeOtherSessions(
    req.user!.id,
    req.sessionId ?? '',
  );

  const devices = await securityService.listDevices(req.user!.id, req.sessionId ?? '');
  sendOk(res, { revoked: count, devices });
};

/** Login history, or the whole account activity timeline. */
export const listEvents = async (req: Request, res: Response): Promise<void> => {
  const query = validatedQuery(req, eventQuerySchema);

  const { rows, total } = await securityService.listEvents({
    userId: req.user!.id,
    scope: query.scope,
    limit: query.limit,
    offset: query.offset,
  });

  sendOk(res, {
    events: rows,
    pagination: {
      total,
      limit: query.limit,
      offset: query.offset,
      hasMore: query.offset + rows.length < total,
    },
  });
};
