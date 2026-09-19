/**
 * Domain types mirroring the API contract.
 *
 * Money always arrives as a pair: `*Paise` is the authoritative integer and the rupee
 * field is for display. Client code computes with paise and renders rupees, so no
 * floating-point arithmetic ever touches a financial figure.
 */

export type Money = { paise: number; rupees: number };

export type GroupRole = 'creator' | 'member';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  inviteCode: string;
  payday: number | null;
  /** Cloudinary URLs, or null when the group has no image of that kind. */
  avatarUrl: string | null;
  coverUrl: string | null;
  createdBy: string;
  createdAt: string;
  role?: GroupRole;
  memberCount?: number;
}

export interface GroupMemberSummary {
  id: string;
  fullName: string;
  email: string;
  upiId: string | null;
  qrCodeUrl: string | null;
  role: GroupRole;
  joinedAt: string;
  owesPaise: number;
  receivesPaise: number;
  owes: number;
  receives: number;
  netPaise: number;
}

export interface BillingCycle {
  payday: number | null;
  startDate: string | null;
  endDate: string | null;
  nextPayday: string | null;
  daysRemaining: number | null;
  isPaydayToday: boolean;
}

export type PaymentMode = 'cash' | 'upi';
/**
 * How an expense's shares were decided. `everyone` and `specific` divide equally and
 * differ only in who is included; the rest carry a per-person figure.
 */
export type SplitType = 'everyone' | 'specific' | 'exact' | 'percentage' | 'shares';

/** The three modes that need a value per participant. */
export const UNEQUAL_SPLIT_TYPES = ['exact', 'percentage', 'shares'] as const;

export type ExpenseCategory =
  | 'groceries'
  | 'food_dining'
  | 'rent'
  | 'utilities'
  | 'entertainment'
  | 'travel'
  | 'household'
  | 'medical'
  | 'other';

export interface ExpenseParticipant {
  userId: string;
  fullName?: string;
  email?: string;
  sharePaise: number;
  share: number;
  /**
   * What the user entered: basis points for a percentage split, the weight for a
   * shares split, null otherwise. Lets an edit reopen on "60%" rather than on the
   * paise it resolved to.
   */
  splitValue?: number | null;
  isPayer?: boolean;
}

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  amountPaise: number;
  amount: number;
  paidBy: string;
  payer?: { id: string; fullName: string; email: string };
  splitType: SplitType;
  paymentMode: PaymentMode;
  category: ExpenseCategory | null;
  expenseDate: string;
  notes: string;
  receiptUrl: string | null;
  hasReceipt: boolean;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
  participants: ExpenseParticipant[];
  mySharePaise?: number;
  myShare?: number;
  involvement?: 'paid_by_me' | 'paid_by_others_for_me' | 'not_involved';
}

export type SettlementStatus =
  | 'paid_pending_approval'
  | 'will_pay_soon'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export interface Settlement {
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
  rejectionReason: string;
  note: string;
  paidAt: string;
  verifiedAt: string | null;
  createdAt: string;
  direction?: 'outgoing' | 'incoming';
}

export interface PersonRef {
  id: string;
  fullName: string;
  email: string;
  upiId: string | null;
  qrCodeUrl: string | null;
  role?: GroupRole;
}

export interface DueEntry {
  user: PersonRef;
  amountPaise: number;
  amount: number;
}

/** LIVE region — the current financial position. Never date-filtered. */
export interface LiveRegion {
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
}

export interface RelationshipRow {
  person: PersonRef;
  isStillMember: boolean;
  iPaidForThem: Money;
  theyPaidForMe: Money;
  relatedExpenseCount: number;
  lastRelatedExpenseDate: string | null;
  iCurrentlyOwe?: Money;
  theyCurrentlyOwe?: Money;
}

export interface RecentExpense {
  id: string;
  title: string;
  amountPaise: number;
  amount: number;
  expenseDate: string;
  paymentMode: PaymentMode;
  splitType: SplitType;
  category: ExpenseCategory | null;
  notes: string;
  hasReceipt: boolean;
  paidBy: string;
  payerName: string;
  participantCount: number;
  mySharePaise: number;
  myShare: number;
  involvement: string;
}

/** ANALYTICS region — period attribution. Never an obligation. */
export interface AnalyticsRegion {
  periodSummary: {
    totalExpense: Money;
    totalPaidByMe: Money;
    myShare: Money;
    paidForOthers: Money;
    paidByOthersForMe: Money;
    averageExpense: Money;
    expenseCount: number;
    largestExpense: {
      id: string;
      title: string;
      amountPaise: number;
      expenseDate: string;
    } | null;
  };
  /**
   * The same headline figures for the equal-length window immediately before this one,
   * or null when the filter is open-ended. Raw figures rather than a percentage, so the
   * client cannot be handed a third number that disagrees with the two it came from.
   */
  previousPeriod: {
    from: string;
    to: string;
    totalExpense: Money;
    totalPaidByMe: Money;
    myShare: Money;
    expenseCount: number;
  } | null;
  relationships: RelationshipRow[];
  topPeopleIPaidFor: { person: string; paise: number; rupees: number }[];
  topPeopleWhoPaidForMe: { person: string; paise: number; rupees: number }[];
  recentExpenses: RecentExpense[];
}

/** CHART region — the time series alone. */
export interface ChartRegion {
  grouping: 'day' | 'week' | 'month';
  periodBreakdown: {
    key: string;
    label: string;
    expenseCount: number;
    totalExpensePaise: number;
    paidByMePaise: number;
    mySharePaise: number;
    totalExpense: number;
    paidByMe: number;
    myShare: number;
  }[];
}

export interface AttentionPayload {
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
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/* -------------------------------------------------------------------------- */
/* Filters                                                                    */
/* -------------------------------------------------------------------------- */

export type DatePreset =
  | 'all'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'last_30_days'
  | 'this_year'
  | 'custom';

export type InvolvementFilter =
  | 'all'
  | 'involving_me'
  | 'paid_by_me'
  | 'paid_by_others_for_me';

export interface ReportFilters {
  preset: DatePreset;
  from?: string;
  to?: string;
  memberId: string;
  paymentMode: 'all' | PaymentMode;
  involvement: InvolvementFilter;
  category?: ExpenseCategory;
}

/** Realtime envelope. Says what changed, never what it is worth. */
export interface RealtimePayload {
  event: string;
  groupId: string;
  actorId: string;
  actorName: string;
  entityId?: string;
  message: string;
  regions: ('live' | 'analytics' | 'chart')[];
  timestamp: string;
}
