/**
 * Turning an untrusted payload into a destination.
 *
 * A notification payload and a deep link are both INPUT FROM OUTSIDE. A push payload has
 * a plausible chain of custody, and a URL has none at all — anybody can type
 * `splitwise://group/<some-uuid>` into a browser and send it to a phone. So nothing here
 * is trusted to be true; it is only trusted to be a *destination*.
 *
 * That distinction is what makes this safe. These functions decide which screen to open.
 * They never decide what the user is allowed to see. The screen then fetches its resource
 * through the ordinary authenticated API, and the server applies `requireGroupMember` and
 * the rest exactly as it would if the user had tapped their way there. A forged id
 * therefore produces a 403 or a 404 and a "not available" screen, never somebody else's
 * expense.
 *
 * The only validation done here is SHAPE: ids must look like UUIDs before they are
 * pasted into a path, so a malformed link cannot smuggle `../` or a query string into the
 * router.
 */

/** Ids in this system are UUIDs. Anything else is not an id and is not routed. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isId = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/** Where the app lists everything it has told the user about. */
export const NOTIFICATIONS_ROUTE = '/notifications';
export const DEVICES_ROUTE = '/settings/devices';
export const SAFE_ROUTE = '/home';

/**
 * The destination for a notification payload.
 *
 * The payload carries only ids and types — see `routeFor` in the server's
 * `notificationService`, which deliberately keeps amounts and names out of it.
 */
export const routeForNotification = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') return null;
  const payload = data as Record<string, unknown>;

  const groupId = isId(payload.groupId) ? payload.groupId : null;
  const entityId = isId(payload.entityId) ? payload.entityId : null;
  const entityType = typeof payload.entityType === 'string' ? payload.entityType : null;
  const type = typeof payload.type === 'string' ? payload.type : null;

  // Security notifications are about the account, not a group, and lead to the place
  // where something can actually be done about them.
  if (type && type.startsWith('security_')) return DEVICES_ROUTE;

  if (groupId && entityId) {
    if (entityType === 'expense') return '/group/' + groupId + '/expense/' + entityId;
    if (entityType === 'settlement') return '/group/' + groupId + '/settlement/' + entityId;
    if (entityType === 'user') return '/group/' + groupId + '/person/' + entityId;
  }

  if (groupId) return '/group/' + groupId;

  // Understood as a notification, but with nothing specific to open. The inbox is the
  // honest destination, rather than guessing.
  return type ? NOTIFICATIONS_ROUTE : null;
};

/**
 * The destination for an incoming URL.
 *
 * Accepts the app's own schemes and, in future, an https origin. The path is rebuilt from
 * recognised segments rather than passed through, so only shapes named here can ever
 * reach the router.
 *
 *   splitwise://group/<uuid>
 *   splitwise://group/<uuid>/expense/<uuid>
 *   splitwise://expense/<uuid>?group=<uuid>
 *   splitwise://settlement/<uuid>?group=<uuid>
 *   splitwise://notifications
 *   splitwise://settings/devices
 */
export const routeForUrl = (url: string): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  /*
   * A custom-scheme URL puts the first segment in `host`, not in `pathname`:
   * `splitwise://group/abc` parses as host "group", path "/abc". An https URL puts
   * everything in `pathname`. Normalising both into one list keeps the rest of this
   * function from caring which arrived.
   */
  const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:';
  const segments = [
    ...(isHttp ? [] : [parsed.hostname]),
    ...parsed.pathname.split('/'),
  ]
    .map((segment) => decodeURIComponent(segment).trim())
    .filter(Boolean);

  if (segments.length === 0) return null;

  const [head, ...rest] = segments;
  const groupFromQuery = parsed.searchParams.get('group');

  if (head === 'notifications') return NOTIFICATIONS_ROUTE;
  if (head === 'settings' && rest[0] === 'devices') return DEVICES_ROUTE;
  if (head === 'settings') return '/settings';

  if (head === 'group' && isId(rest[0])) {
    const groupId = rest[0];
    const [kind, id] = [rest[1], rest[2]];

    if (kind === 'expense' && isId(id)) return '/group/' + groupId + '/expense/' + id;
    if (kind === 'settlement' && isId(id)) return '/group/' + groupId + '/settlement/' + id;
    if (kind === 'person' && isId(id)) return '/group/' + groupId + '/person/' + id;
    return '/group/' + groupId;
  }

  // Shorter forms, for links written by hand or by an email template that does not know
  // the group. They need the group as a query parameter, because every screen below a
  // group is addressed through it.
  if (head === 'expense' && isId(rest[0]) && isId(groupFromQuery)) {
    return '/group/' + groupFromQuery + '/expense/' + rest[0];
  }
  if (head === 'settlement' && isId(rest[0]) && isId(groupFromQuery)) {
    return '/group/' + groupFromQuery + '/settlement/' + rest[0];
  }
  if (head === 'member' && isId(rest[0]) && isId(groupFromQuery)) {
    return '/group/' + groupFromQuery + '/person/' + rest[0];
  }

  return null;
};
