import { apiRequest } from './api';

/**
 * Global search.
 *
 * Results are scoped server-side to the caller's own group memberships, so there is no
 * group parameter here — nothing outside your groups can come back regardless of what
 * the client asks for.
 */

export interface SearchResults {
  groups: { id: string; name: string; memberCount: number; avatarUrl: string | null }[];
  members: {
    id: string;
    fullName: string;
    email: string;
    groupId: string;
    groupName: string;
  }[];
  expenses: {
    id: string;
    title: string;
    amountPaise: number;
    expenseDate: string;
    groupId: string;
    groupName: string;
    payerName: string;
  }[];
  settlements: {
    id: string;
    amountPaise: number;
    status: string;
    groupId: string;
    groupName: string;
    payerName: string;
    receiverName: string | null;
  }[];
  activity: {
    id: string;
    type: string;
    groupId: string;
    groupName: string;
    actorName: string;
    createdAt: string;
  }[];
}

export const MIN_SEARCH_LENGTH = 2;

export const search = (term: string, signal?: AbortSignal) =>
  apiRequest<SearchResults>(`/api/search?q=${encodeURIComponent(term)}`, { signal });

/** Total across every result type, for empty-state decisions. */
export const countResults = (results: SearchResults | null): number =>
  results
    ? results.groups.length +
      results.members.length +
      results.expenses.length +
      results.settlements.length +
      results.activity.length
    : 0;
