import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { admin } from '@/api/endpoints';
import type { AdminActivity } from '@/api/types';
import { AdminListScreen, AdminRow } from '@/features/admin/AdminListScreen';
import { ADMIN_PAGE_SIZE, useAdminList } from '@/features/admin/useAdminList';
import { auditActionLabel, shortDateTime } from '@/features/admin/format';

/**
 * What members have been doing across the platform, newest first, optionally for one
 * group (?groupId=). Entry details are not shown; the type, who and where are enough to
 * find the record.
 */
export default function AdminActivityScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const [search, setSearch] = useState('');

  const list = useAdminList<AdminActivity>(
    async (offset, signal) => {
      const { activities, pagination } = await admin.activity(
        { limit: ADMIN_PAGE_SIZE, offset, search: search.trim() || undefined, groupId: groupId || undefined },
        signal,
      );
      return { rows: activities, pagination };
    },
    groupId ?? '',
    search.trim(),
  );

  return (
    <AdminListScreen
      title={groupId ? 'Group activity' : 'Activity'}
      noun="entry"
      nounPlural="entries"
      list={list}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search activity"
      emptyIcon="activity"
      keyOf={(entry) => entry.id}
      renderRow={(entry) => (
        <AdminRow
          title={auditActionLabel(entry.type)}
          subtitle={entry.actor.fullName + ' · ' + entry.group.name}
          meta={shortDateTime(entry.createdAt)}
          onPress={() => router.push(('/admin/group/' + entry.group.id) as never)}
        />
      )}
    />
  );
}
