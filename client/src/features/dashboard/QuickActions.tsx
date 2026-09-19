import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users2, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

/**
 * The four things people open the dashboard to do.
 *
 * Full-width tap targets in a grid rather than a row of small buttons: on a phone this
 * is the primary way into the app, and a 44px-tall button you have to aim at is the
 * wrong shape for the most-used control on the screen.
 */

interface QuickActionsProps {
  onAddExpense: () => void;
  onSearch: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onAddExpense, onSearch }) => {
  const navigate = useNavigate();
  const { can } = useAuth();

  const actions = [
    ...(can('expenses.create')
      ? [{ id: 'add', label: 'Add expense', icon: Plus, run: onAddExpense, primary: true }]
      : []),
    { id: 'settle', label: 'Settle up', icon: Wallet, run: () => navigate('/app/settlements') },
    { id: 'members', label: 'Members', icon: Users2, run: () => navigate('/app/members') },
    { id: 'search', label: 'Search', icon: Search, run: onSearch },
  ];

  return (
    <section aria-label="Quick actions">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={action.run}
            className={cn(
              'press flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              action.primary
                ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border-border bg-card hover:bg-accent',
            )}
          >
            <action.icon className="h-5 w-5" />
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
};
