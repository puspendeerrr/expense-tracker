import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  jsonb,
  date,
  index,
  uniqueIndex,
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Challenge purposes are deliberately separate so a code minted for one flow can
 * never be replayed against the other.
 */
export const otpPurpose = pgEnum('otp_purpose', [
  'SIGNUP_VERIFICATION',
  'PASSWORD_RESET',
]);

export const userRole = pgEnum('user_role', ['admin', 'user']);

/**
 * Account and group lifecycle.
 *
 * A disabled account cannot sign in and its live sessions are revoked; a disabled group
 * is readable by its members but refuses every write. Neither is a delete: financial
 * history stays intact and the state is reversible.
 */
export const accountStatus = pgEnum('account_status', ['active', 'disabled']);

/** Explicit permission overrides, in both directions. See auth/permissions.ts. */
export const permissionEffect = pgEnum('permission_effect', ['allow', 'deny']);

/** What a spending-dashboard grant is allowed to cover. */
export const dashboardScope = pgEnum('dashboard_scope', ['all_groups', 'selected_groups']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: text('full_name').notNull(),
    /** Always stored lower-cased/trimmed; the unique index is the concurrency guard. */
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull().default('user'),
    status: accountStatus('status').notNull().default('active'),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    /** Shown to the person on the sign-in screen, so a lockout is never mysterious. */
    disabledReason: text('disabled_reason'),
    upiId: text('upi_id'),
    qrCodeUrl: text('qr_code_url'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

/**
 * Short-lived verification challenges. A row exists only between "code sent" and
 * "code consumed/expired" -- this state is intentionally kept out of `users`.
 */
export const otpChallenges = pgTable(
  'otp_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    purpose: otpPurpose('purpose').notNull(),
    /** bcrypt(HMAC-SHA256(otp, OTP_HASH_SECRET)) -- never the raw code. */
    otpHash: text('otp_hash').notNull(),
    /** Signup-only payload, held until the code verifies and the user is created. */
    fullName: text('full_name'),
    passwordHash: text('password_hash'),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }).notNull().defaultNow(),
    resendAvailableAt: timestamp('resend_available_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    /** Set when the challenge is superseded by a resend or burned by max attempts. */
    invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
  },
  (table) => [
    /**
     * At most one live challenge per (email, purpose): this is what makes "only the
     * newest OTP is valid" a database invariant rather than an application promise.
     */
    uniqueIndex('otp_challenges_active_unique')
      .on(table.email, table.purpose)
      .where(sql`${table.consumedAt} is null and ${table.invalidatedAt} is null`),
    index('otp_challenges_email_purpose_idx').on(table.email, table.purpose),
    index('otp_challenges_expires_at_idx').on(table.expiresAt),
  ],
);

/**
 * Opaque, revocable sessions. Only the SHA-256 hash of the cookie token is stored,
 * so a database leak does not hand out usable sessions.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    /**
     * A name the account holder gave this device, e.g. "Work laptop".
     *
     * Null means "not named", and the UI then derives something readable from the user
     * agent. Stored rather than derived-only because the whole point is to let someone
     * tell two identical-looking Chrome-on-Windows rows apart.
     */
    deviceName: text('device_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

/**
 * The authorization minted after a PASSWORD_RESET code verifies. Single-use and
 * short-lived: holding a verified OTP is not enough to set a password twice.
 */
export const passwordResetAuthorizations = pgTable(
  'password_reset_authorizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('password_reset_authorizations_token_hash_unique').on(table.tokenHash),
    index('password_reset_authorizations_user_id_idx').on(table.userId),
  ],
);

/* ========================================================================== */
/* DOMAIN                                                                     */
/*                                                                            */
/* Money is BIGINT paise everywhere. Rupees exist only at the presentation    */
/* boundary, so no stored value can carry floating-point drift.               */
/* ========================================================================== */

export const groupRole = pgEnum('group_role', ['creator', 'member']);
/**
 * How an expense's shares were decided.
 *
 * `everyone` and `specific` both split equally and differ only in who is included.
 * The other three carry per-participant intent, preserved in `split_value`.
 */
export const splitType = pgEnum('split_type', [
  'everyone',
  'specific',
  'exact',
  'percentage',
  'shares',
]);
export const paymentMode = pgEnum('payment_mode', ['cash', 'upi']);
export const expenseCategory = pgEnum('expense_category', [
  'groceries',
  'food_dining',
  'rent',
  'utilities',
  'entertainment',
  'travel',
  'household',
  'medical',
  'other',
]);
export const settlementStatus = pgEnum('settlement_status', [
  'paid_pending_approval',
  'will_pay_soon',
  'completed',
  'rejected',
  'cancelled',
]);
export const activityType = pgEnum('activity_type', [
  'group_created',
  'member_joined',
  'member_left',
  'member_removed',
  'invite_regenerated',
  'payday_updated',
  'expense_created',
  'expense_updated',
  'expense_deleted',
  'settlement_created',
  'settlement_approved',
  'settlement_rejected',
  'settlement_cancelled',
]);
export const notificationType = pgEnum('notification_type', [
  'expense_added',
  'expense_updated',
  'expense_deleted',
  'settlement_requested',
  'settlement_approved',
  'settlement_rejected',
  'member_joined',
  'payment_reminder',
  /*
   * Security notifications.
   *
   * Deliberately part of the same table as everything else, so there is one inbox and
   * one unread count. They are distinguished by type rather than by living somewhere
   * separate, which is what lets the UI treat them as high priority without a second
   * notification system.
   */
  'security_new_device',
  'security_password_changed',
  'security_session_revoked',
]);

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    currency: text('currency').notNull().default('INR'),
    /**
     * Human-typeable join code. The UNIQUE index -- not an application-level
     * pre-check -- is what makes concurrent generation collision-safe.
     */
    inviteCode: text('invite_code').notNull(),
    /** Opaque high-entropy secret for /join/<token> links and QR codes. */
    inviteToken: text('invite_token').notNull(),
    inviteRotatedAt: timestamp('invite_rotated_at', { withTimezone: true }).notNull().defaultNow(),
    status: accountStatus('status').notNull().default('active'),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    /**
     * Group imagery, hosted on Cloudinary.
     *
     * The public id is stored alongside each URL because that is the only handle that
     * can later delete or transform the asset; a secure URL on its own leaks the asset
     * once it is replaced. Both are nullable and always written as a pair.
     */
    avatarUrl: text('avatar_url'),
    avatarPublicId: text('avatar_public_id'),
    coverUrl: text('cover_url'),
    coverPublicId: text('cover_public_id'),
    /** Day of month (1-31) the billing cycle rolls over on. */
    payday: integer('payday'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    /** Set only by the MongoDB importer, so a re-run is idempotent. */
    legacyMongoId: text('legacy_mongo_id'),
  },
  (table) => [
    uniqueIndex('groups_invite_code_unique').on(table.inviteCode),
    uniqueIndex('groups_invite_token_unique').on(table.inviteToken),
    uniqueIndex('groups_legacy_mongo_id_unique').on(table.legacyMongoId),
    index('groups_created_by_idx').on(table.createdBy),
    check('groups_payday_range', sql`${table.payday} is null or (${table.payday} between 1 and 31)`),
  ],
);

export const groupMembers = pgTable(
  'group_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: groupRole('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** Makes double-joining impossible even under concurrent requests. */
    uniqueIndex('group_members_group_user_unique').on(table.groupId, table.userId),
    index('group_members_user_idx').on(table.userId),
    index('group_members_group_idx').on(table.groupId),
  ],
);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull(),
    /** RESTRICT: a user who funded history cannot be hard-deleted out from under it. */
    paidBy: uuid('paid_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    splitType: splitType('split_type').notNull().default('everyone'),
    paymentMode: paymentMode('payment_mode').notNull().default('cash'),
    category: expenseCategory('category'),
    /** Calendar day the spend happened, distinct from the created_at audit stamp. */
    expenseDate: date('expense_date').notNull(),
    notes: text('notes').notNull().default(''),
    receiptUrl: text('receipt_url'),
    receiptStorageKey: text('receipt_storage_key'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    legacyMongoId: text('legacy_mongo_id'),
  },
  (table) => [
    index('expenses_group_date_idx').on(table.groupId, table.expenseDate.desc()),
    index('expenses_group_paid_by_idx').on(table.groupId, table.paidBy),
    index('expenses_group_created_idx').on(table.groupId, table.createdAt.desc()),
    uniqueIndex('expenses_legacy_mongo_id_unique').on(table.legacyMongoId),
    check('expenses_amount_positive', sql`${table.amountPaise} > 0`),
  ],
);

/**
 * The authoritative, immutable historical attribution for one expense.
 *
 * Shares are frozen at write time and are NEVER recomputed from the current member
 * list, so changing group membership cannot rewrite financial history.
 */
export const expenseParticipants = pgTable(
  'expense_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    expenseId: uuid('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    sharePaise: bigint('share_paise', { mode: 'number' }).notNull(),
    /**
     * What the user actually entered, so an edit can reopen showing "40%" rather than
     * the paise it resolved to. Units depend on the expense's split type: basis points
     * for `percentage`, the weight for `shares`, and null for the equal splits and
     * for `exact` (where `share_paise` already is the entered value).
     */
    splitValue: bigint('split_value', { mode: 'number' }),
  },
  (table) => [
    uniqueIndex('expense_participants_expense_user_unique').on(table.expenseId, table.userId),
    index('expense_participants_user_idx').on(table.userId),
    index('expense_participants_expense_idx').on(table.expenseId),
    check('expense_participants_share_non_negative', sql`${table.sharePaise} >= 0`),
    check(
      'expense_participants_split_value_non_negative',
      sql`${table.splitValue} is null or ${table.splitValue} >= 0`,
    ),
  ],
);

export const settlements = pgTable(
  'settlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    payerId: uuid('payer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    receiverId: uuid('receiver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    amountPaise: bigint('amount_paise', { mode: 'number' }).notNull(),
    status: settlementStatus('status').notNull().default('paid_pending_approval'),
    paymentMethod: paymentMode('payment_method').notNull().default('upi'),
    proofUrl: text('proof_url'),
    proofStorageKey: text('proof_storage_key'),
    rejectionReason: text('rejection_reason').notNull().default(''),
    note: text('note').notNull().default(''),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    legacyMongoId: text('legacy_mongo_id'),
  },
  (table) => [
    index('settlements_group_status_idx').on(table.groupId, table.status),
    index('settlements_group_created_idx').on(table.groupId, table.createdAt.desc()),
    index('settlements_payer_status_idx').on(table.payerId, table.status),
    index('settlements_receiver_status_idx').on(table.receiverId, table.status),
    uniqueIndex('settlements_legacy_mongo_id_unique').on(table.legacyMongoId),
    check('settlements_amount_positive', sql`${table.amountPaise} > 0`),
    check('settlements_distinct_parties', sql`${table.payerId} <> ${table.receiverId}`),
  ],
);

/**
 * Structured audit trail. Unlike the reference's pre-rendered English sentences,
 * the type plus JSONB metadata keeps entries filterable and translatable.
 */
export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: activityType('type').notNull(),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    legacyMongoId: text('legacy_mongo_id'),
  },
  (table) => [
    index('activities_group_created_idx').on(table.groupId, table.createdAt.desc()),
    index('activities_actor_idx').on(table.actorUserId),
    uniqueIndex('activities_legacy_mongo_id_unique').on(table.legacyMongoId),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipientUserId: uuid('recipient_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    senderUserId: uuid('sender_user_id').references(() => users.id, { onDelete: 'set null' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_recipient_created_idx').on(
      table.recipientUserId,
      table.createdAt.desc(),
    ),
    index('notifications_recipient_unread_idx')
      .on(table.recipientUserId)
      .where(sql`${table.readAt} is null`),
  ],
);

/**
 * Account-level security events.
 *
 * One table serves both the login history and the account activity timeline, because
 * they are the same records filtered differently -- splitting them would mean two
 * places to write to and two chances to forget one.
 *
 * Failed logins are recorded only for addresses that belong to a real account. Storing
 * attempts against unknown addresses would fill the table with attacker-supplied
 * strings that no one can ever be shown, since there is no account to show them to.
 */
export const accountEventType = pgEnum('account_event_type', [
  'login_succeeded',
  'login_failed',
  'logout',
  'new_device_detected',
  'session_revoked',
  'sessions_revoked_all',
  'password_changed',
  'password_reset',
  'device_renamed',
  'profile_updated',
  'account_deactivated',
  'account_reactivated',
  'data_exported',
]);

export const accountEvents = pgTable(
  'account_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: accountEventType('type').notNull(),
    /** The session this happened on or to, where one applies. */
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    /**
     * Coarse device signature -- browser and OS family only.
     *
     * Used to decide whether a login is from a new device. Deliberately coarse: a
     * signature that included the full version string would fire a "new device" alert
     * every time Chrome updated itself, and an alert that cries wolf is worse than no
     * alert at all.
     */
    deviceSignature: text('device_signature'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('account_events_user_created_idx').on(table.userId, table.createdAt.desc()),
    // Powers the new-device lookup, which asks for one user's prior signatures.
    index('account_events_user_signature_idx').on(table.userId, table.deviceSignature),
  ],
);

export type AccountEvent = typeof accountEvents.$inferSelect;

/**
 * Per-user dashboard layout.
 *
 * One row per account rather than per account-and-group: someone who arranges their
 * dashboard means "this is how I like to see a dashboard", not "this is how I like to
 * see Flat 402". Making it per-group would mean rearranging it again for every group
 * they join.
 *
 * `widgets` holds order and visibility for the widgets this user has an opinion about.
 * It is not the list of widgets that exist -- the code is. Merging the two at read time
 * means a widget added in a later release appears for everyone instead of being
 * invisible to every account that saved a layout before it existed.
 */
export const dashboardMode = pgEnum('dashboard_mode', ['summary', 'detailed']);
export const dashboardView = pgEnum('dashboard_view', ['group', 'personal']);

export const userDashboardPreferences = pgTable('user_dashboard_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  mode: dashboardMode('mode').notNull().default('detailed'),
  view: dashboardView('view').notNull().default('group'),
  widgets: jsonb('widgets')
    .$type<{ id: string; visible: boolean }[]>()
    .notNull()
    .default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserDashboardPreferences = typeof userDashboardPreferences.$inferSelect;

export type User = typeof users.$inferSelect;
export type OtpChallenge = typeof otpChallenges.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type PasswordResetAuthorization = typeof passwordResetAuthorizations.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseParticipant = typeof expenseParticipants.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

/**
 * Web push subscriptions.
 *
 * A subscription belongs to a browser, not to an account, so one user legitimately has
 * several. The endpoint is globally unique and is what the push service addresses, so it
 * carries the unique index.
 */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    /** Keys from the browser's PushSubscription; opaque to us. */
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('push_subscriptions_endpoint_unique').on(table.endpoint),
    index('push_subscriptions_user_idx').on(table.userId),
  ],
);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;

/**
 * Explicit permission overrides.
 *
 * Absence of a row means "whatever the registry default is", which is why this table
 * stays small: only the deliberate exceptions are stored. `effect` allows an admin to
 * revoke an ordinarily-default capability as well as grant an unusual one.
 */
export const userPermissions = pgTable(
  'user_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** A key from the code-side registry; validated on write, never trusted on read. */
    permission: text('permission').notNull(),
    effect: permissionEffect('effect').notNull(),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_permissions_user_permission_unique').on(table.userId, table.permission),
    index('user_permissions_user_idx').on(table.userId),
  ],
);

/**
 * Scope attached to a `dashboard.spending` grant.
 *
 * The permission says a person may open the spending dashboard; this says whose numbers
 * it may contain. Kept separate from the permission row because it is data about the
 * grant, not about the capability, and because it is queried on every dashboard load.
 */
export const dashboardGrants = pgTable(
  'dashboard_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: dashboardScope('scope').notNull().default('selected_groups'),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('dashboard_grants_user_unique').on(table.userId)],
);

/** Which groups a `selected_groups` dashboard grant covers. */
export const dashboardGrantGroups = pgTable(
  'dashboard_grant_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    grantId: uuid('grant_id')
      .notNull()
      .references(() => dashboardGrants.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('dashboard_grant_groups_unique').on(table.grantId, table.groupId),
    index('dashboard_grant_groups_group_idx').on(table.groupId),
  ],
);

/**
 * Record of every history purge.
 *
 * A purge is irreversible, so what was destroyed, by whom and over what range has to
 * outlive the rows themselves. This table is deliberately never exposed to a delete
 * endpoint.
 */
export const purgeAudits = pgTable(
  'purge_audits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    /** Kept as text so the record survives the group being deleted later. */
    groupName: text('group_name').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email').notNull(),
    fromDate: date('from_date').notNull(),
    toDate: date('to_date').notNull(),
    expensesDeleted: integer('expenses_deleted').notNull(),
    settlementsDeleted: integer('settlements_deleted').notNull(),
    activitiesDeleted: integer('activities_deleted').notNull(),
    amountPurgedPaise: bigint('amount_purged_paise', { mode: 'number' }).notNull().default(0),
    /** The exact filter the operator confirmed, for reconstructing what happened. */
    filters: jsonb('filters').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('purge_audits_group_idx').on(table.groupId),
    index('purge_audits_created_idx').on(table.createdAt.desc()),
  ],
);

/**
 * Immutable record of administrative mutations.
 *
 * Generalises the pattern `purge_audits` proved: what happened, who did it, to whom,
 * and when -- written in the same transaction as the change itself so the record cannot
 * be lost while the change succeeds.
 *
 * Actor and target identities are denormalised alongside their foreign keys. The keys
 * are `set null` on delete so history survives the deletion of an account or group,
 * which is exactly when an audit trail matters most.
 *
 * `metadata` is for describing the change. It must never carry a credential: there is a
 * strip step in the service, because an audit log is one of the easiest places to leak a
 * password by accident.
 */
export const adminAudits = pgTable(
  'admin_audits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email').notNull(),
    /** Dotted action key, e.g. `user.disabled`, `group.creator_transferred`. */
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: uuid('target_id'),
    /** Human label captured at the time, so a deleted target is still identifiable. */
    targetLabel: text('target_label'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('admin_audits_created_idx').on(table.createdAt.desc()),
    index('admin_audits_actor_idx').on(table.actorUserId),
    index('admin_audits_target_idx').on(table.targetType, table.targetId),
    index('admin_audits_action_idx').on(table.action),
  ],
);
