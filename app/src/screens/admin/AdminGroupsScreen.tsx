import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { admin } from '@/api/endpoints';
import { AdminListScreen, AdminRow } from '@/features/admin/AdminListScreen';
import { ADMIN_PAGE_SIZE, useAdminList } from '@/features/admin/useAdminList';
import { plural, shortDate } from '@/features/admin/format';
import { SMBadge } from '@/components/sm';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/tokens';
import { formatPaise } from '@/lib/money';

type Filter = 'all' | 'active' | 'disabled';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
];

/** Every group on the platform. Invite codes are deliberately not shown. */
export default function AdminGroupsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const list = useAdminList(
    async (offset, signal) => {
      const { groups, pagination } = await admin.groups(
        {
          limit: ADMIN_PAGE_SIZE,
          offset,
          search: search.trim() || undefined,
          status: filter === 'all' ? undefined : filter,
        },
        signal,
      );
      return { rows: groups, pagination };
    },
    filter,
    search.trim(),
  );

  return (
    <AdminListScreen
      title="Groups"
      noun="group"
      list={list}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search group name"
      filter={{ label: 'Filter groups', options: FILTERS, value: filter, onChange: setFilter }}
      emptyIcon="group"
      keyOf={(group) => group.id}
      renderRow={(group) => (
        <AdminRow
          title={group.name}
          subtitle={'Created by ' + group.creatorName}
          meta={
            plural(group.memberCount, 'member') +
            ' · ' +
            plural(group.expenseCount, 'expense') +
            (group.lastActivityAt ? ' · active ' + shortDate(group.lastActivityAt) : '')
          }
          badges={group.status === 'disabled' ? <SMBadge label="Disabled" tone="danger" /> : undefined}
          trailing={
            <View>
              <Text style={[styles.value, { color: colors.text }]}>{formatPaise(group.totalValuePaise, { compact: true })}</Text>
            </View>
          }
          onPress={() => router.push(('/admin/group/' + group.id) as never)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  value: { fontSize: typography.bodySm, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
