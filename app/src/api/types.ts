/**
 * The shapes the server actually sends.
 *
 * These mirror the `public*` helpers in the backend's controllers. They are deliberately
 * narrow: this app reads what it needs and nothing more, so adding a field server-side
 * never obliges a mobile release.
 *
 * Every money field is integer paise, named `...Paise`. The server is the only thing that
 * produces these numbers. Nothing in this app derives a balance, a share or a net
 * position from them — see `src/lib/money.ts`, which formats and never calculates.
 */

export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'disabled';
export type GroupRole = 'creator' | 'member';

export type User = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  upiId: string | null;
  qrCodeUrl: string | null;
  status: UserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
};

/** How a person appears wherever they are referenced rather than fully described. */
export type PersonRef = {
  id: string;
  fullName: string;
  email: string;
  upiId?: string | null;
  qrCodeUrl?: string | null;
  role?: GroupRole;
};

export type Group = {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  inviteCode: string;
  payday?: number | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  createdBy: string;
  createdAt: string;
  role?: GroupRole;
  memberCount?: number;
};

/**
 * A member as `GET /groups/:groupId` returns them.
 *
 * `owesPaise` / `receivesPaise` come from the balance engine's group totals, and
 * `netPaise` is the server's own subtraction of the two — not ours.
 */
export type GroupMember = {
  id: string;
  fullName: string;
  email: string;
  upiId: string | null;
  qrCodeUrl: string | null;
  role: GroupRole;
  joinedAt: string;
  owesPaise: number;
  receivesPaise: number;
  netPaise: number;
};

export type BillingCycle = {
  start: string;
  end: string;
  payday: number | null;
} | null;

export type GroupDetail = {
  group: Group;
  billingCycle: BillingCycle;
  members: GroupMember[];
};

/* -------------------------------------------------------------------------- */
/* Expenses                                                                   */
/* -------------------------------------------------------------------------- */

export type SplitType = 'everyone' | 'specific' | 'exact' | 'percentage' | 'shares';
export type PaymentMode = 'cash' | 'upi';

/** How the viewer relates to an expense. The server decides this, not the client. */
export type Involvement = 'paid_by_me' | 'paid_by_others_for_me' | 'not_involved';

export type ExpenseParticipant = {
  userId: string;
  sharePaise: number;
  share: number;
  /**
   * What was originally entered for this person — 60 for "60%", a weight for shares.
   * Kept so the edit form can reopen on the input rather than on the paise it resolved
   * to. Null for an equal split, where nobody entered anything per person.
   */
  splitValue: number | null;
};

export type Expense = {
  id: string;
  groupId: string;
  title: string;
  amountPaise: number;
  amount: number;
  paidBy: string;
  payer?: { id: string; fullName: string; email: string };
  splitType: SplitType;
  paymentMode: PaymentMode;
  category: string | null;
  expenseDate: string;
  notes: string | null;
  receiptUrl: string | null;
  hasReceipt: boolean;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
  participants: ExpenseParticipant[];
  mySharePaise?: number;
  myShare?: number;
  involvement?: Involvement;
};

export type Pagination = { total: number; limit: number; offset: number; hasMore: boolean };

export type ExpenseListPayload = { expenses: Expense[]; pagination: Pagination };

/**
 * What the Add/Edit form sends.
 *
 * The shape is dictated by the server's `.strict()` schema, which rejects unknown keys
 * and enforces the relationship between `splitType`, `participantIds` and `splits`:
 * `specific` needs participant ids and no splits; `exact`, `percentage` and `shares` need
 * splits and no participant ids; `everyone` needs neither.
 *
 * `amount` and each `splits[].value` are sent as the user typed them. The server parses
 * rupees into paise and percentages into basis points, so the conversion happens once, in
 * the place that also validates it.
 */
export type ExpenseInput = {
  title: string;
  amount: string;
  paidBy?: string;
  splitType: SplitType;
  participantIds?: string[];
  splits?: { userId: string; value: string }[];
  paymentMode: PaymentMode;
  category?: string | null;
  expenseDate: string;
  notes?: string;
  receiptUrl?: string | null;
};

export type ExpenseFilters = {
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
  memberId?: string;
  paidBy?: string;
  paymentMode?: 'all' | PaymentMode;
  category?: string;
  involvement?: 'all' | 'involving_me' | 'paid_by_me' | 'paid_by_others_for_me';
  search?: string;
};

/* -------------------------------------------------------------------------- */
/* Balances                                                                   */
/* -------------------------------------------------------------------------- */

export type Money = { paise: number; rupees: number };

/** One directional obligation, as the balance engine reports it. */
export type DueEntry = { user: PersonRef; amountPaise: number; amount: number };

/**
 * `scope=live` from the reports endpoint: the authoritative current picture of a group.
 *
 * This is the single source for every balance the app displays. Debts here are pairwise
 * and directional and are never netted — if two people owe each other, both obligations
 * appear, which is a deliberate product rule, not an oversight.
 */
export type LiveRegion = {
  group: { id: string; name: string; currency: string; payday: number | null; role: GroupRole };
  billingCycle: BillingCycle;
  balances: {
    youNeedToPayTotal: Money;
    youWillReceiveTotal: Money;
    netBalance: Money;
    peopleIOweCount: number;
    peopleWhoOweMeCount: number;
  };
  peopleIOwe: DueEntry[];
  peopleWhoOweMe: DueEntry[];
  members: PersonRef[];
  attention: {
    awaitingMyApprovalCount: number;
    awaitingTheirApprovalCount: number;
    rejectedNeedingActionCount: number;
    myPromisesCount: number;
    promisesToMeCount: number;
    totalActionable: number;
  };
};

/**
 * `scope=analytics`: spending history for the selected window.
 *
 * Kept separate from `LiveRegion` because the two answer different questions. Live says
 * what is owed right now and is never date-filtered; analytics says what was spent over a
 * period. Mixing them is how a dashboard ends up showing a "balance" that quietly means
 * "balance within these dates".
 */
export type AnalyticsRegion = {
  periodSummary: {
    totalExpense: Money;
    totalPaidByMe: Money;
    myShare: Money;
    paidForOthers: Money;
    paidByOthersForMe: Money;
    averageExpense: Money;
    expenseCount: number;
    largestExpense: { id: string; title: string; amountPaise: number; expenseDate: string } | null;
  };
  relationships: RelationshipRow[];
  recentExpenses: RecentExpense[];
};

export type RelationshipRow = {
  person: PersonRef;
  isStillMember: boolean;
  iPaidForThem: Money;
  theyPaidForMe: Money;
  relatedExpenseCount: number;
  lastRelatedExpenseDate: string | null;
  iCurrentlyOwe?: Money;
  theyCurrentlyOwe?: Money;
};

/** The trimmed expense shape the reports endpoint returns for "recent". */
export type RecentExpense = {
  id: string;
  title: string;
  amountPaise: number;
  amount: number;
  expenseDate: string;
  paymentMode: PaymentMode;
  splitType: SplitType;
  category: string | null;
  notes: string;
  hasReceipt: boolean;
  paidBy: string;
  payerName: string;
  participantCount: number;
  mySharePaise: number;
  myShare: number;
  involvement: string;
};

/** Both directions between the viewer and one other person, plus the settleable ceiling. */
export type Outstanding = {
  counterpartId: string;
  iOwePaise: number;
  iOwe: number;
  theyOwePaise: number;
  theyOwe: number;
  /** The most the viewer may record as a payment right now. Enforced again server-side. */
  maxSettleablePaise: number;
};

/* -------------------------------------------------------------------------- */
/* Settlements                                                                */
/* -------------------------------------------------------------------------- */

export type SettlementStatus =
  | 'paid_pending_approval'
  | 'will_pay_soon'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type Settlement = {
  id: string;
  groupId: string;
  payerId: string;
  receiverId: string;
  amountPaise: number;
  amount: number;
  status: SettlementStatus;
  paymentMethod: PaymentMode;
  proofUrl: string | null;
  hasProof: boolean;
  rejectionReason: string | null;
  note: string | null;
  paidAt: string;
  verifiedAt: string | null;
  createdAt: string;
  direction?: 'outgoing' | 'incoming';
};

export type SettlementListPayload = { settlements: Settlement[]; pagination: Pagination };

export type SettlementInput = {
  receiverId: string;
  amount: string;
  paymentMethod: PaymentMode;
  /** `will_pay_soon` records an intention. It never moves a balance. */
  actionType: 'payment' | 'will_pay_soon';
  proofUrl?: string | null;
  note?: string;
};

export type AttentionPayload = {
  awaitingMyApproval: Settlement[];
  awaitingTheirApproval: Settlement[];
  rejectedNeedingAction: Settlement[];
  myPromises: Settlement[];
  promisesToMe: Settlement[];
  totalActionable: number;
  balances: {
    youNeedToPayTotalPaise: number;
    youWillReceiveTotalPaise: number;
    netBalancePaise: number;
  };
};

/* -------------------------------------------------------------------------- */
/* Activity                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * One entry in a group's history.
 *
 * The server stores a type plus metadata rather than a finished sentence, so the wording
 * is composed on the client. That is what lets the phone and the web word the same event
 * differently without the database having to know about either.
 */
export type Activity = {
  id: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: PersonRef;
  isMe: boolean;
};

export type ActivityListPayload = { activities: Activity[]; pagination: Pagination };

export type ActivityFilters = {
  limit?: number;
  offset?: number;
  search?: string;
  type?: string;
  actorId?: string;
  from?: string;
  to?: string;
};

/**
 * The permission slugs the server resolved for this user, role defaults and per-user
 * overrides already applied. Membership in the list is the whole check.
 *
 * Hiding a control on the strength of one of these is a courtesy to the user, never a
 * security measure: the server re-checks every one of them on the request itself.
 */
export type Permissions = string[];

export type SessionPayload = { user: User; permissions: Permissions };

/* -------------------------------------------------------------------------- */
/* Notifications, devices and sessions (Phase 4)                              */
/* -------------------------------------------------------------------------- */

export type NotificationType =
  | 'expense_added'
  | 'expense_updated'
  | 'expense_deleted'
  | 'settlement_requested'
  | 'settlement_approved'
  | 'settlement_rejected'
  | 'member_joined'
  | 'payment_reminder'
  | 'security_new_device'
  | 'security_password_changed'
  | 'security_session_revoked';

/**
 * One entry in the inbox.
 *
 * Security notifications live in the same table as everything else, distinguished by
 * type rather than by a separate system, which is what gives the app one inbox and one
 * unread count.
 */
export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  groupId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type NotificationListPayload = {
  notifications: AppNotification[];
  unreadCount: number;
  pagination: Pagination;
};

/** The categories a user can switch off. `security` governs the push, not the record. */
export type NotificationPreferences = {
  pushEnabled: boolean;
  financial: boolean;
  settlements: boolean;
  activity: boolean;
  security: boolean;
  general: boolean;
};

/** A registered native install. The push token is deliberately not part of this shape. */
export type PushDevice = {
  id: string;
  installationId: string;
  platform: 'android' | 'ios';
  deviceName: string | null;
  appVersion: string | null;
  notificationsEnabled: boolean;
  lastActiveAt: string;
  createdAt: string;
};

/**
 * A live session, as the security endpoints report it.
 *
 * `device` is a coarse signature derived from the user agent — browser and OS family
 * only. No token, cookie or credential is ever included.
 */
export type SessionDevice = {
  id: string;
  name: string | null;
  device: string;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

export type AccountEvent = {
  id: string;
  type: string;
  ipAddress: string | null;
  device: string | null;
  createdAt: string;
};

/* -------------------------------------------------------------------------- */
/* AI assistant (Phase 5)                                                     */
/* -------------------------------------------------------------------------- */

export type AiSourceType = 'expense' | 'settlement' | 'group' | 'member';

/**
 * A record the assistant used to answer.
 *
 * Produced by the backend's own retrieval from PostgreSQL, so a source is always
 * something the user was already authorised to see. `groupId` is what makes a source
 * navigable: every screen below a group is addressed through it.
 */
export type AiSource = {
  type: AiSourceType;
  id: string;
  label: string;
  groupId?: string;
  groupName?: string;
};

export type AiChatResponse = {
  answer: string;
  sources: AiSource[];
  intent: string;
  language: 'en' | 'hi' | 'hinglish';
  metadata: {
    tokensUsed?: number;
    latencyMs: number;
    dataPointsUsed: number;
  };
};

/** One turn, as the backend's bounded history expects it. */
export type AiHistoryItem = { role: 'user' | 'assistant'; content: string };

/* -------------------------------------------------------------------------- */
/* Group administration and auth parity (Phase 9)                             */
/* -------------------------------------------------------------------------- */

/** What the server hands back so an invite can be shared. */
export type GroupShareInfo = {
  inviteCode: string;
  inviteToken: string;
  invitePath: string;
  inviteRotatedAt: string;
};

/** A look at a group before committing to join it. */
export type InvitePreview = {
  group?: { id: string; name: string; description: string | null; memberCount?: number };
  alreadyMember?: boolean;
  [key: string]: unknown;
};

/**
 * Everything an OTP screen needs to run its own countdowns.
 *
 * `serverTime` is included so the countdown is anchored to the server's clock rather than
 * the phone's -- a device whose clock is wrong would otherwise show a resend timer that
 * never reaches zero, or one that is already expired.
 */
export type OtpChallenge = {
  email: string;
  maskedEmail: string;
  expiresAt: string;
  resendAvailableAt: string;
  serverTime: string;
  maxAttempts: number;
};
