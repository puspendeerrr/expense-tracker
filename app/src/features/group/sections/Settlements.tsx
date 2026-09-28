import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { settlements as settlementsApi } from '@/api/endpoints';
import type { SettlementListPayload } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useGroup, useMemberLookup } from '../GroupContext';
import { useAuth } from '@/auth/AuthProvider';
import { describeSettlement, settlementChips } from '../chips';
import {
  SMButton,
  SMChipFilter,
  SMEmptyState,
  SMErrorState,
  SMInlineNotice,
  SMRowSkeleton,
  SMSettlementListItem,
} from '@/components/sm';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';
import { formatInstant, formatPaise } from '@/lib/money';

const PAGE = 20;

type StatusFilter = 'all' | 'paid_pending_approval' | 'will_pay_soon' | 'completed' | 'rejected' | 'cancelled';

/** Exactly the values the server's list endpoint accepts for `status`, nothing more. */
const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid_pending_approval', label: 'Waiting' },
  { value: 'will_pay_soon', label: 'Promised' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function SettlementsSection() {
  const { colors } = useTheme();
  const { groupId, live, revision } = useGroup();
  const lookup = useMemberLookup();
  const { user } = useAuth();
  const router = useRouter();

  const [status, setStatus] = useState<StatusFilter>('all');
  const [limit, setLimit] = useState(PAGE);

  const request = useRequest<SettlementListPayload>(
    useCallback(
      (signal: AbortSignal) => settlementsApi.list(groupId, { status, limit }, signal),
      [groupId, status, limit],
    ),
    [groupId, status, limit, revision],
  );

  const rows = request.data?.settlements ?? [];
  const hasMore = request.data?.pagination.hasMore ?? false;
  const actionable = live?.attention.totalActionable ?? 0;

  const open = (id: string): void => {
    router.push(('/group/' + groupId + '/settlement/' + id) as never);
  };

  return (
    <View style={styles.container}>
      <SMButton
        label="Settle up"
        icon="settlement"
        variant="primary"
        fullWidth
        onPress={() => router.push(('/group/' + groupId + '/settle') as never)}
      />

      {actionable > 0 ? (
        <SMInlineNotice
          type="warning"
          title={actionable === 1 ? '1 payment needs your confirmation' : actionable + ' payments need your confirmation'}
          message="Someone says they've paid you. Open it, check the proof, and confirm or reject it."
        />
      ) : null}

      <SMChipFilter
        accessibilityLabel="Filter settlements by status"
        options={FILTERS}
        value={status}
        onChange={(next) => {
          setStatus(next);
          setLimit(PAGE);
        }}
      />

      {request.loading && !request.data ? (
        <SMRowSkeleton rows={4} />
      ) : request.error && !request.data ? (
        <SMErrorState error={request.error} onRetry={() => void request.refresh()} />
      ) : rows.length === 0 ? (
        status === 'all' ? (
          <SMEmptyState
            icon="settlement"
            title="No settlements yet"
            description="Payments and promises to pay in this group will show up here."
            primaryAction={{
              label: 'Settle up',
              icon: 'settlement',
              onPress: () => router.push(('/group/' + groupId + '/settle') as never),
            }}
          />
        ) : (
          <SMEmptyState
            icon="filter"
            title={status === 'paid_pending_approval' ? "You're all caught up" : 'No settlements match this filter'}
            description={
              status === 'paid_pending_approval'
                ? 'Nothing in this group is waiting for confirmation.'
                : 'There are settlements in this group, just none with this status.'
            }
            primaryAction={{ label: 'Show all', onPress: () => setStatus('all') }}
          />
        )
      ) : (
        <View style={styles.list}>
          {rows.map((settlement) => {
            const described = describeSettlement(settlement, user?.id, (id) => lookup(id).fullName);

            return (
              <SMSettlementListItem
                key={settlement.id}
                title={described.title}
                amount={formatPaise(settlement.amountPaise, { compact: true })}
                dateLabel={formatInstant(settlement.paidAt)}
                tone={described.tone}
                chips={settlementChips(settlement)}
                onPress={() => open(settlement.id)}
              />
            );
          })}

          {hasMore ? (
            <SMButton
              label={request.refreshing ? 'Loading…' : 'Load more'}
              variant="secondary"
              loading={request.refreshing}
              onPress={() => setLimit((value) => value + PAGE)}
              style={{ marginTop: spacing.sm }}
            />
          ) : (
            <Text style={[styles.end, { color: colors.muted }]}>
              {`Showing all ${request.data?.pagination.total ?? rows.length} settlements`}
            </Text>
          )}
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.base, gap: spacing.base },
  toolbar: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  notice: { marginBottom: spacing.xs },
  noticeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  list: { gap: spacing.sm },
  end: {
    textAlign: 'center',
    fontSize: typography.caption,
    paddingVertical: spacing.md,
  },
});
