import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { admin } from '@/api/endpoints';
import type { AdminUser } from '@/api/types';
import { AdminListScreen, AdminRow } from '@/features/admin/AdminListScreen';
import { ADMIN_PAGE_SIZE, useAdminList } from '@/features/admin/useAdminList';
import { plural, shortDate, shortDateTime } from '@/features/admin/format';
import { SMAvatar, SMBadge, SMButton, SMDetailRow, SMSheet } from '@/components/sm';
import { spacing } from '@/theme/tokens';

type Filter = 'all' | 'admin' | 'active' | 'disabled';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'admin', label: 'Admins' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
];

/**
 * Every account on the platform, searched and filtered by the server.
 *
 * Tapping a person opens what the list already knows about them. There is no single-user
 * admin route, so nothing further is fetched, and nothing here can change the account.
 * Credentials of any kind are never part of these rows.
 */
export default function AdminUsersScreen() {
  const router = useRouter();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [search, setSearch] = useState(q ?? '');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<AdminUser | null>(null);

  const list = useAdminList(
    async (offset, signal) => {
      const { users, pagination } = await admin.users(
        {
          limit: ADMIN_PAGE_SIZE,
          offset,
          search: search.trim() || undefined,
          role: filter === 'admin' ? 'admin' : undefined,
          status: filter === 'active' || filter === 'disabled' ? filter : undefined,
        },
        signal,
      );
      return { rows: users, pagination };
    },
    filter,
    search.trim(),
  );

  return (
    <>
      <AdminListScreen
        title="Users"
        noun="user"
        list={list}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search name or email"
        filter={{ label: 'Filter users', options: FILTERS, value: filter, onChange: setFilter }}
        emptyIcon="users"
        keyOf={(user) => user.id}
        renderRow={(user) => (
          <AdminRow
            title={user.fullName}
            subtitle={user.email}
            meta={plural(user.groupCount, 'group') + ' · ' + plural(user.expenseCount, 'expense') + ' · joined ' + shortDate(user.createdAt)}
            badges={<UserBadges user={user} />}
            onPress={() => setOpen(user)}
          />
        )}
      />

      <SMSheet visible={open !== null} onClose={() => setOpen(null)} title={open?.fullName ?? ''} subtitle={open?.email ?? ''}>
        {open ? (
          <View style={styles.sheet}>
            <View style={styles.head}>
              <SMAvatar name={open.fullName} size={48} round />
              <UserBadges user={open} />
            </View>
            <SMDetailRow label="Role" value={open.role === 'admin' ? 'Administrator' : 'Member'} />
            <SMDetailRow label="Status" value={open.status === 'disabled' ? 'Disabled' : 'Active'} />
            {open.status === 'disabled' && open.disabledAt ? (
              <SMDetailRow label="Disabled on" value={shortDateTime(open.disabledAt)} />
            ) : null}
            {open.status === 'disabled' && open.disabledReason ? (
              <SMDetailRow label="Reason" value={open.disabledReason} />
            ) : null}
            <SMDetailRow label="Email verified" value={open.isVerified ? 'Yes' : 'No'} />
            <SMDetailRow label="Groups" value={open.groupCount.toLocaleString()} />
            <SMDetailRow label="Expenses paid" value={open.expenseCount.toLocaleString()} />
            <SMDetailRow label="Signed in on" value={plural(open.activeSessions, 'device')} />
            <SMDetailRow
              label="Permission overrides"
              value={open.permissionOverrideCount === 0 ? 'None' : open.permissionOverrideCount.toLocaleString()}
            />
            <SMDetailRow label="Joined" value={shortDateTime(open.createdAt)} />
            <SMButton
              label="View permissions"
              icon="key"
              variant="secondary"
              fullWidth
              onPress={() => {
                const person = open;
                setOpen(null);
                router.push(
                  ('/admin/permissions/' + person.id + '?name=' + encodeURIComponent(person.fullName)) as never,
                );
              }}
            />
          </View>
        ) : null}
      </SMSheet>
    </>
  );
}

function UserBadges({ user }: { user: AdminUser }) {
  return (
    <View style={styles.badges}>
      {user.role === 'admin' ? <SMBadge label="Admin" tone="warning" icon="shield" /> : null}
      {user.status === 'disabled' ? <SMBadge label="Disabled" tone="danger" /> : null}
      {!user.isVerified ? <SMBadge label="Unverified" tone="neutral" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.sm, paddingBottom: spacing.base },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
