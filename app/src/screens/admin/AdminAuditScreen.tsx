import { useState } from 'react';
import { admin } from '@/api/endpoints';
import type { AdminAudit } from '@/api/types';
import { AdminListScreen, AdminRow } from '@/features/admin/AdminListScreen';
import { ADMIN_PAGE_SIZE, useAdminList } from '@/features/admin/useAdminList';
import { auditActionLabel, shortDateTime } from '@/features/admin/format';

/**
 * The admin audit trail, newest first. The server has no route that edits or removes an
 * entry, and this screen only reads. Each entry's metadata is not shown: it is free-form,
 * and the console displays only fields it knows to be safe.
 */
export default function AdminAuditScreen() {
  const [search, setSearch] = useState('');

  const list = useAdminList<AdminAudit>(
    async (offset, signal) => {
      const { audits, pagination } = await admin.audit(
        { limit: ADMIN_PAGE_SIZE, offset, search: search.trim() || undefined },
        signal,
      );
      return { rows: audits, pagination };
    },
    '',
    search.trim(),
  );

  return (
    <AdminListScreen
      title="Audit log"
      noun="entry"
      nounPlural="entries"
      list={list}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search actions, people or targets"
      emptyIcon="shield"
      keyOf={(entry) => entry.id}
      renderRow={(entry) => (
        <AdminRow
          title={auditActionLabel(entry.action)}
          subtitle={'By ' + (entry.actor?.fullName ?? entry.actorEmail)}
          meta={(entry.targetLabel ? entry.targetLabel + ' · ' : '') + shortDateTime(entry.createdAt)}
        />
      )}
    />
  );
}
