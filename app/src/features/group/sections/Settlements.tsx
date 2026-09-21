import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { settlements as settlementsApi } from '@/api/endpoints';
import type { SettlementListPayload } from '@/api/types';
import { useRequest } from '@/hooks/useRequest';
import { useGroup, useMemberLookup } from '../GroupContext';
import { SettlementCard } from '../cards';
import { Card, CardSkeleton, OptionRow } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';
import { SETTLEMENT_STATUS_LABELS } from '@/lib/money';

const PAGE = 20;

const STATUSES = [
  'all',
  'paid_pending_approval',
  'will_pay_soon',
  'completed',
  'rejected',
  'cancelled',
] as const;

export function SettlementsSection() {
  const { colors } = useTheme();
  const { groupId, live, revision } = useGroup();
  const lookup = useMemberLookup();
  const router = useRouter();

  const [status, setStatus] = useState<string>('all');
  const [limit, setLimit] = useState(PAGE);
  const [sheet, setSheet] = useState(false);

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
      <View style={styles.toolbar}>
        <PrimaryButton
          label="Settle Up"
          icon="settlement"
          variant="primary"
          onPress={() => router.push(('/group/' + groupId + '/settle') as never)}
          style={{ flex: 1.2 }}
        />
        <PrimaryButton
          label={status === 'all' ? 'Status filter' : (SETTLEMENT_STATUS_LABELS[status] ?? status)}
          icon="filter"
          variant="secondary"
          onPress={() => setSheet(true)}
          style={{ flex: 1 }}
        />
      </View>

      {actionable > 0 ? (
        <View style={styles.notice}>
          <Card
            style={{
              backgroundColor: colors.warningLight,
              borderColor: colors.warning,
            }}
          >
            <View style={styles.noticeHeader}>
              <Icon name="alert" size={18} tone="warning" />
              <Text style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}>
                {actionable === 1 ? '1 payment requires your approval' : `${actionable} payments require your approval`}
              </Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: typography.caption, lineHeight: 18 }}>
              Someone sent you a payment request. Inspect the proof and confirm or reject it below.
            </Text>
          </Card>
        </View>
      ) : null}

      {request.loading && !request.data ? (
        <CardSkeleton rows={4} />
      ) : request.error && !request.data ? (
        <ErrorState error={request.error} onRetry={() => void request.refresh()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={status === 'all' ? 'No settlements yet' : 'No settlements found'}
          message={
            status === 'all'
              ? 'Recorded payments and settled debts will appear here.'
              : 'There are no settlements matching the selected status.'
          }
          icon="settlement"
          {...(status === 'all'
            ? {
                action: {
                  label: 'Settle Up',
                  onPress: () => router.push(('/group/' + groupId + '/settle') as never),
                  variant: 'primary',
                },
              }
            : {
                action: {
                  label: 'Show all',
                  onPress: () => setStatus('all'),
                  variant: 'secondary',
                },
              })}
        />
      ) : (
        <View style={styles.list}>
          {rows.map((settlement) => (
            <SettlementCard
              key={settlement.id}
              settlement={settlement}
              payerName={lookup(settlement.payerId).fullName}
              receiverName={lookup(settlement.receiverId).fullName}
              onPress={() => open(settlement.id)}
            />
          ))}

          {hasMore ? (
            <PrimaryButton
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

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Filter by Status">
        {STATUSES.map((value) => (
          <OptionRow
            key={value}
            label={value === 'all' ? 'All settlements' : (SETTLEMENT_STATUS_LABELS[value] ?? value)}
            selected={status === value}
            onPress={() => {
              setStatus(value);
              setLimit(PAGE);
              setSheet(false);
            }}
          />
        ))}
      </Sheet>
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
