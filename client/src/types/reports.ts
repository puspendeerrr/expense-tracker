import { Settlement, User, BillingCycle } from './index';

/** A person as returned by the reporting endpoint. */
export interface ReportPerson {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  upiId?: string;
  qrCodeUrl?: string | null;
  role?: 'creator' | 'member';
}

export interface PendingSettlementRef {
  settlementId: string;
  status: Settlement['status'];
  amount: number;
  direction: 'outgoing' | 'incoming';
}

/** One row of the person-wise dues list (live balance-engine figures). */
export interface PersonDueRow {
  user: ReportPerson;
  amount: number;
  role?: 'creator' | 'member';
  relatedExpenseCount: number;
  lastRelatedExpenseDate: string | null;
  pendingSettlement: PendingSettlementRef | null;
}

/**
 * One row of the financial-relationship table.
 *
 * `iPaidForThem` / `theyPaidForMe` are period-scoped spending ATTRIBUTION.
 * `iCurrentlyOwe` / `theyCurrentlyOwe` are all-time live OBLIGATIONS from the balance engine.
 * `netRelationship` is display-only and never replaces the two directional obligations.
 */
export interface RelationshipRow {
  person: ReportPerson;
  iPaidForThem: number;
  theyPaidForMe: number;
  iCurrentlyOwe: number;
  theyCurrentlyOwe: number;
  netRelationship: number;
  relatedExpenseCount: number;
  lastRelatedExpenseDate: string | null;
  isStillMember: boolean;
}

export interface PeriodBucket {
  key: string;
  label: string;
  expenseCount: number;
  totalExpense: number;
  paidByMe: number;
  myShare: number;
  paidForOthers: number;
  paidByOthersForMe: number;
  expenseIds: string[];
}

export interface RecentExpenseRow {
  _id: string;
  title: string;
  amount: number;
  date: string;
  createdAt?: string;
  paidBy: User;
  paymentMode: 'cash' | 'upi';
  splitType: 'everyone' | 'specific';
  participantCount: number;
  myShare: number;
  hasReceipt: boolean;
  notes: string;
  involvement: 'paid_by_me' | 'paid_by_others_for_me' | 'not_involved';
}

export interface ReportBalances {
  youNeedToPayTotal: number;
  youWillReceiveTotal: number;
  netBalance: number;
  peopleIOweCount: number;
  peopleWhoOweMeCount: number;
}

export interface PeriodSummary {
  totalExpense: number;
  totalPaidByMe: number;
  myShare: number;
  paidForOthers: number;
  paidByOthersForMe: number;
  expenseCount: number;
  averageExpense: number;
  largestExpense: { _id: string; title: string; amount: number; date: string } | null;
}

export interface AttentionBuckets {
  awaitingMyApproval: Settlement[];
  awaitingTheirApproval: Settlement[];
  rejectedNeedingAction: Settlement[];
  myPromises: Settlement[];
  promisesToMe: Settlement[];
  totalActionable: number;
}

export interface AppliedFilters {
  from: string | null;
  to: string | null;
  memberId: string;
  memberName: string;
  paymentMode: string;
  involvement: string;
  preset: string;
  rangeLabel: string;
  grouping: 'day' | 'week' | 'month';
}

export interface DashboardReport {
  hasGroup: boolean;
  generatedAt: string;
  group: {
    _id: string;
    name: string;
    inviteCode: string;
    payday: number | null;
    userRole: 'creator' | 'member';
  };
  billingCycle: BillingCycle;
  filters: AppliedFilters;
  balances: ReportBalances;
  periodSummary: PeriodSummary;
  peopleIOwe: PersonDueRow[];
  peopleWhoOweMe: PersonDueRow[];
  relationships: RelationshipRow[];
  periodBreakdown: PeriodBucket[];
  topPeopleIPaidFor: { person: string; amount: number }[];
  topPeopleWhoPaidForMe: { person: string; amount: number }[];
  recentExpenses: RecentExpenseRow[];
  attention: AttentionBuckets;
  settlements: Settlement[];
  members: ReportPerson[];
}
