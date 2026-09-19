import React from 'react';
import { AdminLayout } from '../AdminLayout';
import { AdminPageHeader } from '../AdminPageHeader';
import { AdminGroupSettlements } from './panels/AdminGroupSettlements';

/**
 * Platform-wide settlements.
 *
 * Reuses the panel the group detail screen embeds, so there is one settlement table
 * rather than two that drift. Passing no `groupId` widens it to every group.
 */
export const AdminSettlements: React.FC = () => (
  <AdminLayout title="Settlements">
      <AdminPageHeader
        title="Settlements"
        description="Payments between members, with the live outstanding debt behind each one."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Settlements' }]}
      />
    <AdminGroupSettlements />
  </AdminLayout>
);
