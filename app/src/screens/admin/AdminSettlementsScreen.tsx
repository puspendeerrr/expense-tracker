import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { admin } from '@/api/endpoints';
import type { AdminSettlement, AdminSettlementStatus } from '@/api/types';
import { AdminListScreen, AdminRow } from '@/features/admin/AdminListScreen';
import { ADMIN_PAGE_SIZE, useAdminList } from '@/features/admin/useAdminList';
import { shortDate, shortDateTime } from '@/features/admin/format';
import { SMDetailRow, SMSettlementStatus, SMSheet } from '@/components/sm';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';
import { formatPaise } from '@/lib/money';

type Filter = 'all' | AdminSettlementStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid_pending_approval', label: 'Waiting' },
  { value: 'will_pay_soon', label: 'Promised' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

/**
 * Settlements across the platform, optionally for one group (?groupId=).
 *
 * Each row carries the live debt between the two people, which the server takes from the
 * balance engine. Only the members involved can confirm or reject a payment; nothing here
 * changes one.
 */
export default function AdminSettlementsScreen() {
  const { colors } = useTheme();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<AdminSettlement | null>(null);

  const list = useAdminList<AdminSettlement>(
    async (offset, signal) => {
      const { settlements, pagination } = await admin.settlements(
        {
          limit: ADMIN_PAGE_SIZE,
          offset,
          search: search.trim() || undefined,
          groupId: groupId || undefined,
          status: filter === 'all' ? undefined : filter,
        },
        signal,
      );
      return { rows: settlements, pagination };
    },
    filter + '|' + (groupId ?? ''),
    search.trim(),
  );

  const parties = (s: AdminSettlement): string => s.payer.fullName + ' → ' + (s.receiver?.fullName ?? 'Removed account');

  return (
    <>
      <AdminListScreen
        title={groupId ? 'Group settlements' : 'Settlements'}
        noun="settlement"
        list={list}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search settlements"
        filter={{ label: 'Filter by status', options: FILTERS, value: filter, onChange: setFilter }}
        emptyIcon="settlement"
        keyOf={(settlement) => settlement.id}
        renderRow={(settlement) => (
          <AdminRow
            title={parties(settlement)}
            subtitle={settlement.group.name + ' · ' + shortDate(settlement.paidAt)}
            badges={<SMSettlementStatus status={settlement.status} />}
            trailing={<Text style={[styles.amount, { color: colors.text }]}>{formatPaise(settlement.amountPaise)}</Text>}
            onPress={() => setOpen(settlement)}
          />
        )}
      />

      <SMSheet
        visible={open !== null}
        onClose={() => setOpen(null)}
        title={open ? formatPaise(open.amountPaise) : ''}
        subtitle={open ? parties(open) : ''}
      >
        {open ? (
          <View style={styles.sheet}>
            <SMSettlementStatus status={open.status} size="md" />
            <SMDetailRow label="Group" value={open.group.name} />
            <SMDetailRow label="From" value={open.payer.fullName + '\n' + open.payer.email} />
            <SMDetailRow label="To" value={open.receiver ? open.receiver.fullName + '\n' + open.receiver.email : 'Removed account'} />
            <SMDetailRow label="Method" value={open.paymentMethod.toUpperCase()} />
            <SMDetailRow label="Proof" value={open.hasProof ? 'Attached' : 'None'} />
            {open.note ? <SMDetailRow label="Note" value={open.note} /> : null}
            <SMDetailRow label="Paid on" value={shortDateTime(open.paidAt)} />
            <SMDetailRow label="Recorded" value={shortDateTime(open.createdAt)} />
            <SMDetailRow
              label="Still owed now"
              value={open.outstandingPaise > 0 ? formatPaise(open.outstandingPaise) : 'Nothing'}
            />
          </View>
        ) : null}
      </SMSheet>
    </>
  );
}

const styles = StyleSheet.create({
  amount: { fontSize: typography.bodySm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sheet: { gap: spacing.sm, paddingBottom: spacing.base },
});
