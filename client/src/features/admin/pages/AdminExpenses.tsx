import React from 'react';
import { AdminLayout } from '../AdminLayout';
import { AdminPageHeader } from '../AdminPageHeader';
import { AdminGroupExpenses } from './panels/AdminGroupExpenses';

/**
 * Platform-wide expenses. Reuses the group panel with no `groupId`, so there is one
 * expense table rather than two implementations to keep in step.
 */
export const AdminExpenses: React.FC = () => (
  <AdminLayout title="Expenses">
      <AdminPageHeader
        title="Expenses"
        description="Every expense recorded on the platform, across all groups."
        crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Expenses' }]}
      />
    <AdminGroupExpenses onChanged={() => undefined} />
  </AdminLayout>
);
