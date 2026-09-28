import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { admin } from '@/api/endpoints';
import type { AdminExpense } from '@/api/types';
import { AdminListScreen, AdminRow } from '@/features/admin/AdminListScreen';
import { ADMIN_PAGE_SIZE, useAdminList } from '@/features/admin/useAdminList';
import { plural, shortDate } from '@/features/admin/format';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/tokens';
import { formatPaise } from '@/lib/money';

/**
 * Expenses across the platform, optionally for one group (?groupId=). Read-only: an
 * expense is changed by the people in its group, not from here.
 */
export default function AdminExpensesScreen() {
  const { colors } = useTheme();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const [search, setSearch] = useState('');
  const [totalValue, setTotalValue] = useState<number | null>(null);

  const list = useAdminList<AdminExpense>(
    async (offset, signal) => {
      const { expenses, pagination, totalValuePaise } = await admin.expenses(
        { limit: ADMIN_PAGE_SIZE, offset, search: search.trim() || undefined, groupId: groupId || undefined },
        signal,
      );
      setTotalValue(totalValuePaise);
      return { rows: expenses, pagination };
    },
    groupId ?? '',
    search.trim(),
  );

  return (
    <AdminListScreen
      title={groupId ? 'Group expenses' : 'Expenses'}
      noun="expense"
      list={list}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search expenses"
      {...(totalValue !== null ? { summary: formatPaise(totalValue) + ' in total' } : {})}
      emptyIcon="expense"
      keyOf={(expense) => expense.id}
      renderRow={(expense) => (
        <AdminRow
          title={expense.title}
          subtitle={expense.groupName + ' · paid by ' + expense.payerName}
          meta={shortDate(expense.expenseDate) + ' · split ' + plural(expense.participantCount, 'way')}
          trailing={<Text style={[styles.amount, { color: colors.text }]}>{formatPaise(expense.amountPaise)}</Text>}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  amount: { fontSize: typography.bodySm, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
