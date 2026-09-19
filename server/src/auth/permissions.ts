/**
 * Platform permission registry.
 *
 * DESIGN
 * ------
 * Every capability in the product has a key here. A user's effective set is the
 * registry defaults, overridden by explicit `allow`/`deny` rows an administrator has
 * set against them. That two-layer model is what lets an admin both *grant* something
 * unusual (the spending dashboard) and *revoke* something ordinary (adding expenses)
 * without needing a row for every user and every capability.
 *
 * `role: 'admin'` is a separate, higher switch: an administrator implicitly holds every
 * permission. It is deliberately not expressible as a grant, so there is exactly one
 * way to become an administrator and one place to audit it.
 *
 * Keys are stored as text rather than a database enum. A permission is a code concept —
 * it only means anything because a route checks it — so adding one should be a code
 * change, not a migration. `permissionKeySchema` is the validation boundary that keeps
 * unknown keys out of the table.
 */

export type PermissionCategory = 'platform' | 'groups' | 'money' | 'insights';

export type PermissionDefinition = {
  key: string;
  label: string;
  description: string;
  category: PermissionCategory;
  /** Whether an ordinary new user holds this without an explicit grant. */
  defaultGranted: boolean;
  /**
   * True for capabilities that hand over administrative power. These are never default
   * granted and the UI marks them out.
   */
  sensitive?: boolean;
};

export const PERMISSIONS = [
  /* ---- Platform administration ---- */
  {
    key: 'admin.access',
    label: 'Open the admin console',
    description: 'See the administration area and its platform-wide reporting.',
    category: 'platform',
    defaultGranted: false,
    sensitive: true,
  },
  {
    key: 'admin.users.manage',
    label: 'Manage users',
    description:
      'Enable, disable and delete accounts, and reset passwords. Does not allow acting as another user.',
    category: 'platform',
    defaultGranted: false,
    sensitive: true,
  },
  {
    key: 'admin.groups.manage',
    label: 'Manage groups',
    description: 'Enable, disable and delete any group on the platform.',
    category: 'platform',
    defaultGranted: false,
    sensitive: true,
  },
  {
    key: 'admin.permissions.manage',
    label: 'Manage permissions',
    description: 'Grant and revoke these capabilities for other people.',
    category: 'platform',
    defaultGranted: false,
    sensitive: true,
  },

  /* ---- Groups ---- */
  {
    key: 'groups.create',
    label: 'Create groups',
    description: 'Start a new group and become its creator.',
    category: 'groups',
    defaultGranted: true,
  },
  {
    key: 'groups.join',
    label: 'Join groups',
    description: 'Join a group using an invite code, link or QR.',
    category: 'groups',
    defaultGranted: true,
  },
  {
    key: 'groups.invite',
    label: 'Share and rotate invites',
    description: 'View a group invite and regenerate it.',
    category: 'groups',
    defaultGranted: true,
  },
  {
    key: 'groups.members.remind',
    label: 'Send payment reminders',
    description: 'Nudge someone in a group who owes money.',
    category: 'groups',
    defaultGranted: true,
  },

  /* ---- Money ---- */
  {
    key: 'expenses.create',
    label: 'Add expenses',
    description: 'Record a new expense in a group.',
    category: 'money',
    defaultGranted: true,
  },
  {
    key: 'expenses.modify',
    label: 'Edit and delete expenses',
    description:
      'Change or remove an expense. The existing rule still applies: only the person who paid may edit it.',
    category: 'money',
    defaultGranted: true,
  },
  {
    key: 'settlements.create',
    label: 'Record payments',
    description: 'Record a payment or a promise to pay.',
    category: 'money',
    defaultGranted: true,
  },
  {
    key: 'history.purge',
    label: 'Clear group history',
    description:
      'Permanently delete a date range of expenses, payments and activity. Only ever applies to a group they created, and only where it would not change what anyone owes.',
    category: 'money',
    // Granted by default so a group leader can tidy their own group, but marked
    // sensitive and revocable: the route additionally requires group creator, and an
    // administrator can take it away from any individual.
    defaultGranted: true,
    sensitive: true,
  },

  /* ---- Insights ---- */
  {
    key: 'reports.export',
    label: 'Export reports',
    description: 'Download the Excel workbook for a group.',
    category: 'insights',
    defaultGranted: true,
  },
  {
    key: 'dashboard.spending',
    label: 'Person-wise spending dashboard',
    description:
      'See the spending analytics dashboard. What it covers is set separately when the permission is granted.',
    category: 'insights',
    defaultGranted: false,
  },
] as const satisfies readonly PermissionDefinition[];

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

export const PERMISSION_KEYS = PERMISSIONS.map((permission) => permission.key) as PermissionKey[];

const BY_KEY = new Map<string, PermissionDefinition>(
  PERMISSIONS.map((permission) => [permission.key, permission]),
);

export const isPermissionKey = (value: string): value is PermissionKey => BY_KEY.has(value);

export const getPermission = (key: string): PermissionDefinition | undefined => BY_KEY.get(key);

/** Capabilities an ordinary account holds with no explicit grants. */
export const DEFAULT_PERMISSIONS: PermissionKey[] = PERMISSIONS.filter(
  (permission) => permission.defaultGranted,
).map((permission) => permission.key) as PermissionKey[];

/**
 * Resolves a user's effective permissions.
 *
 * Administrators hold everything. For everyone else the registry defaults apply, with
 * explicit rows taking precedence in both directions.
 */
export const resolvePermissions = (
  role: 'admin' | 'user',
  overrides: { permission: string; effect: 'allow' | 'deny' }[],
): Set<string> => {
  if (role === 'admin') return new Set<string>(PERMISSION_KEYS);

  const effective = new Set<string>(DEFAULT_PERMISSIONS);

  for (const override of overrides) {
    // Ignore keys that no longer exist in the registry rather than trusting stale rows.
    if (!isPermissionKey(override.permission)) continue;
    if (override.effect === 'allow') effective.add(override.permission);
    else effective.delete(override.permission);
  }

  return effective;
};
