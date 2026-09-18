import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Alert, Button, Typography, Space, Avatar, Empty, Skeleton, Divider } from 'antd';
import { ClockCircleOutlined, UserOutlined, ReloadOutlined } from '@ant-design/icons';

import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../components/ui/Toast';
import { useReportFilters } from '../hooks/useReportFilters';
import { useDashboardReport } from '../hooks/useDashboardReport';
import { useExcelExport } from '../hooks/useExcelExport';
import api from '../services/api';

import { Expense, GroupMember, OwedPerson, Settlement, User, Activity } from '../types';
import { PersonDueRow, RelationshipRow, PeriodBucket } from '../types/reports';
import { formatTimeAgo, formatDateTime, MONEY_COLORS } from '../utils/format';

// Dashboard sections
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { ReportFilterBar } from '../components/dashboard/ReportFilterBar';
import { SummaryCards } from '../components/dashboard/SummaryCards';
import { PersonWiseBalances } from '../components/dashboard/PersonWiseBalances';
import { FinancialRelationshipTable } from '../components/dashboard/FinancialRelationshipTable';
import { SpendingAnalytics } from '../components/dashboard/SpendingAnalytics';
import { ExpensesOverTime } from '../components/dashboard/ExpensesOverTime';
import { AttentionCenter } from '../components/dashboard/AttentionCenter';
import { RecentExpensesList } from '../components/dashboard/RecentExpensesList';
import { ExportExcelModal } from '../components/dashboard/ExportExcelModal';

// Existing modals — reused unchanged
import { AddExpenseModal } from '../components/modals/AddExpenseModal';
import { ExpenseDetailModal } from '../components/modals/ExpenseDetailModal';
import { EditExpenseModal } from '../components/modals/EditExpenseModal';
import { BreakdownModal } from '../components/modals/BreakdownModal';
import { SettlementModal } from '../components/modals/SettlementModal';
import { UPIDetailModal } from '../components/modals/UPIDetailModal';
import { MemberDetailModal } from '../components/modals/MemberDetailModal';
import { SettlementDetailsDrawer } from '../components/modals/SettlementDetailsDrawer';

const { Text } = Typography;

/**
 * A quiet group heading. Eight sibling cards read as a wall; four labelled groups read as a
 * document, which is what §23's priority order actually asks for.
 */
const SectionLabel: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <div className="dash-section-label">
    <h2 className="dash-section-label__text">{children}</h2>
    {hint && <span className="dash-section-label__hint">{hint}</span>}
  </div>
);

export const Dashboard: React.FC = () => {
  const { user, group, userRole } = useAuth();
  const { socket, isConnected } = useSocket();
  const { showError, showSuccess } = useToast();
  const navigate = useNavigate();

  const { filters, setFilters, setFilter, reset, range, activeCount } = useReportFilters();
  const [groupBy, setGroupBy] = useState<'auto' | 'day' | 'week' | 'month'>('auto');

  const { report, isLoading, isRefreshing, error, lastUpdated, refresh } = useDashboardReport(
    filters,
    groupBy,
    socket,
    !!user
  );

  // --- Modal state (all existing components) ---------------------------
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [breakdownType, setBreakdownType] = useState<'need_to_pay' | 'will_receive' | null>(null);
  const [settlementTarget, setSettlementTarget] = useState<OwedPerson | null>(null);
  const [activeSettlement, setActiveSettlement] = useState<Settlement | null>(null);
  const [upiModalUser, setUpiModalUser] = useState<User | null>(null);
  const [upiModalAmount, setUpiModalAmount] = useState<number | undefined>(undefined);
  const [detailMember, setDetailMember] = useState<GroupMember | null>(null);
  const [remindLoadingMap, setRemindLoadingMap] = useState<Record<string, boolean>>({});

  // Group activity stays on the original dashboard endpoint — it is not report-scoped.
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);

  const { isExporting, exportReport } = useExcelExport(showSuccess, showError);

  // --- Groupless users still belong on /no-group -----------------------
  useEffect(() => {
    if (!isLoading && report && report.hasGroup === false) {
      navigate('/no-group');
    }
  }, [isLoading, report, navigate]);

  // --- Activity feed (kept lightweight, refreshed with the report) -----
  const loadActivity = useCallback(async () => {
    try {
      const res = await api.get('/dashboard');
      setRecentActivity(res.data?.recentActivity || []);
    } catch {
      // Activity is non-critical context; a failure must not blank the financial sections.
      setRecentActivity([]);
    }
  }, []);

  useEffect(() => {
    loadActivity();
  }, [loadActivity, lastUpdated]);

  // --- Actions ---------------------------------------------------------
  const handleRemind = useCallback(
    async (targetUserId: string, targetName: string) => {
      try {
        setRemindLoadingMap((prev) => ({ ...prev, [targetUserId]: true }));
        await api.post('/groups/remind-member', { targetUserId });
        showSuccess(`Payment reminder sent to ${targetName}!`);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        showError(msg || 'Failed to send reminder');
      } finally {
        setRemindLoadingMap((prev) => ({ ...prev, [targetUserId]: false }));
      }
    },
    [showError, showSuccess]
  );

  const openSettlementFor = useCallback((row: PersonDueRow) => {
    setSettlementTarget({
      user: {
        _id: row.user._id,
        fullName: row.user.fullName,
        email: row.user.email,
        phone: row.user.phone,
        upiId: row.user.upiId,
        qrCodeUrl: row.user.qrCodeUrl,
      },
      amount: row.amount,
    });
  }, []);

  const openUpiFor = useCallback((row: PersonDueRow) => {
    setUpiModalUser({
      _id: row.user._id,
      fullName: row.user.fullName,
      email: row.user.email,
      phone: row.user.phone,
      upiId: row.user.upiId || '',
      qrCodeUrl: row.user.qrCodeUrl || null,
    });
    setUpiModalAmount(row.amount);
  }, []);

  /** Open the existing expense detail modal by id (rows carry ids, not full documents). */
  const openExpenseById = useCallback(
    async (expenseId: string) => {
      try {
        const res = await api.get(`/expenses/${expenseId}`);
        setSelectedExpense(res.data);
      } catch {
        showError('Could not load that expense.');
      }
    },
    [showError]
  );

  /** Drill-down: fetch the expenses behind one chart bucket. */
  const loadBucketExpenses = useCallback(
    async (bucket: PeriodBucket): Promise<Expense[]> => {
      try {
        const res = await api.get('/expenses');
        const all: Expense[] = res.data || [];
        const ids = new Set(bucket.expenseIds);
        return all.filter((e) => ids.has(e._id));
      } catch {
        showError('Could not load expenses for that period.');
        return [];
      }
    },
    [showError]
  );

  /**
   * Reuse the existing MemberDetailModal by mapping a relationship row onto the GroupMember
   * shape it already understands, rather than building a second member-detail surface.
   */
  const openMemberDetails = useCallback(
    (row: RelationshipRow) => {
      setDetailMember({
        _id: row.person._id,
        fullName: row.person.fullName,
        email: row.person.email,
        phone: row.person.phone,
        upiId: row.person.upiId,
        qrCodeUrl: row.person.qrCodeUrl,
        role: row.person.role || 'member',
        joinedAt: '',
        totalPaid: row.iPaidForThem + row.theyPaidForMe,
        everyoneShare: 0,
        specificShare: 0,
        totalOwes: row.iCurrentlyOwe,
        totalReceives: row.theyCurrentlyOwe,
        netBalance: row.netRelationship,
        owesList: row.iCurrentlyOwe > 0
          ? [{ user: { ...row.person, upiId: row.person.upiId, qrCodeUrl: row.person.qrCodeUrl }, amount: row.iCurrentlyOwe }]
          : [],
        receivesList: row.theyCurrentlyOwe > 0
          ? [{ user: { ...row.person, upiId: row.person.upiId, qrCodeUrl: row.person.qrCodeUrl }, amount: row.theyCurrentlyOwe }]
          : [],
      });
    },
    []
  );

  const handleExport = useCallback(
    async (exportFilters: typeof filters) => {
      const ok = await exportReport(exportFilters);
      if (ok) setIsExportOpen(false);
    },
    [exportReport]
  );

  const afterMutation = useCallback(() => {
    refresh({ silent: true });
    loadActivity();
  }, [refresh, loadActivity]);

  // --- Derived ---------------------------------------------------------
  const isCreator = userRole === 'creator';
  const members = report?.members || [];

  /** Members in the shape AddExpense / EditExpense already expect. */
  const memberList = useMemo<GroupMember[]>(
    () =>
      members.map((m) => ({
        _id: m._id,
        fullName: m.fullName,
        email: m.email,
        phone: m.phone,
        upiId: m.upiId,
        qrCodeUrl: m.qrCodeUrl,
        role: m.role || 'member',
        joinedAt: '',
        totalPaid: 0,
        totalOwes: 0,
        totalReceives: 0,
      })),
    [members]
  );

  const breakdownList = useMemo<OwedPerson[]>(() => {
    const source = breakdownType === 'need_to_pay' ? report?.peopleIOwe : report?.peopleWhoOweMe;
    return (source || []).map((r) => ({ user: r.user, amount: r.amount }));
  }, [breakdownType, report]);

  // --- Hard error state (nothing rendered yet) -------------------------
  if (error && !report) {
    return (
      <div style={{ padding: 4 }}>
        <Alert
          type="error"
          showIcon
          message="Unable to load your dashboard"
          description={error}
          action={
            <Button size="small" type="primary" icon={<ReloadOutlined />} onClick={() => refresh()}>
              Retry
            </Button>
          }
          style={{ borderRadius: 12 }}
        />
      </div>
    );
  }

  return (
    <div className="dash-page">
      {/* ── A. Header ─────────────────────────────────────────────── */}
      <DashboardHeader
        groupName={report?.group?.name || group?.name || 'Your group'}
        billingCycle={report?.billingCycle || null}
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        isLive={isConnected}
        onExport={() => setIsExportOpen(true)}
        onRefresh={() => refresh()}
        onAddExpense={() => setIsAddExpenseOpen(true)}
      />

      {/* A non-blocking banner when a background refresh failed but stale data is still shown. */}
      {error && report && (
        <Alert
          type="warning"
          showIcon
          closable
          message="Some data may be out of date"
          description={error}
          action={
            <Button size="small" onClick={() => refresh()}>Retry</Button>
          }
          style={{ borderRadius: 12 }}
        />
      )}

      {/* ── B. Filters — stays reachable while scrolling a long page ─ */}
      <div className="dash-filterbar-sticky">
        <ReportFilterBar
          filters={filters}
          onChange={setFilter}
          onApply={setFilters}
          onReset={reset}
          members={members}
          currentUserId={user?._id}
          rangeLabel={range.label}
          activeCount={activeCount}
          disabled={isLoading}
          summary={
            report?.periodSummary
              ? {
                  expenseCount: report.periodSummary.expenseCount,
                  totalExpense: report.periodSummary.totalExpense,
                }
              : null
          }
        />
      </div>

      {/* ── 1. Current financial position ─────────────────────────── */}
      <section className="dash-group" aria-label="Your current position">
        <SectionLabel hint="All time">Your Position</SectionLabel>

        <SummaryCards
          balances={report?.balances || null}
          periodSummary={report?.periodSummary || null}
          rangeLabel={range.label}
          isLoading={isLoading}
          onOpenPayables={() => setBreakdownType('need_to_pay')}
          onOpenReceivables={() => setBreakdownType('will_receive')}
        />

        {(isLoading || (report?.attention?.totalActionable ?? 0) > 0) && (
          <AttentionCenter
            attention={report?.attention || null}
            isLoading={isLoading}
            onOpenSettlement={setActiveSettlement}
          />
        )}
      </section>

      {/* ── 2 & 3. People ─────────────────────────────────────────── */}
      <section className="dash-group" aria-label="Balances by person">
        <SectionLabel hint="Who owes whom">People</SectionLabel>

        <PersonWiseBalances
          peopleIOwe={report?.peopleIOwe || []}
          peopleWhoOweMe={report?.peopleWhoOweMe || []}
          isLoading={isLoading}
          isCreator={isCreator}
          remindLoadingMap={remindLoadingMap}
          onSettle={openSettlementFor}
          onShowUpi={openUpiFor}
          onRemind={handleRemind}
        />

        <FinancialRelationshipTable
          rows={report?.relationships || []}
          isLoading={isLoading}
          rangeLabel={range.label}
          onViewDetails={openMemberDetails}
        />
      </section>

      {/* ── 4. Spending analytics ─────────────────────────────────── */}
      <section className="dash-group" aria-label="Spending analytics">
        <SectionLabel hint={range.label}>Spending Analytics</SectionLabel>

        <SpendingAnalytics
          summary={report?.periodSummary || null}
          topPeopleIPaidFor={report?.topPeopleIPaidFor || []}
          topPeopleWhoPaidForMe={report?.topPeopleWhoPaidForMe || []}
          relationships={report?.relationships || []}
          rangeLabel={range.label}
          isLoading={isLoading}
        />

        <ExpensesOverTime
          buckets={report?.periodBreakdown || []}
          grouping={report?.filters?.grouping || 'day'}
          totalExpense={report?.periodSummary?.totalExpense || 0}
          rangeLabel={range.label}
          isLoading={isLoading}
          onGroupingChange={setGroupBy}
          activeGrouping={groupBy}
          onLoadBucketExpenses={loadBucketExpenses}
          onSelectExpense={setSelectedExpense}
        />
      </section>

      {/* ── 6 & 7. Recent ─────────────────────────────────────────── */}
      <section className="dash-group" aria-label="Recent activity">
        <SectionLabel>Recent</SectionLabel>

        <RecentExpensesList
          expenses={report?.recentExpenses || []}
          isLoading={isLoading}
          rangeLabel={range.label}
          onSelect={openExpenseById}
          onViewAll={() => navigate('/expenses')}
        />

        <Card
        size="small"
        title={
          <Space size={6}>
            <ClockCircleOutlined style={{ color: '#94a3b8', fontSize: 12 }} aria-hidden="true" />
            <Text type="secondary" style={{ fontSize: 12.5, fontWeight: 600 }}>
              Recent Group Activity
            </Text>
          </Space>
        }
        style={{ borderRadius: 14, background: '#fcfcfd' }}
        styles={{ body: { padding: 10 } }}
      >
        {isLoading && recentActivity.length === 0 ? (
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
        ) : recentActivity.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<Text type="secondary" style={{ fontSize: 12 }}>No recent group activity.</Text>}
            style={{ margin: '8px 0' }}
          />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recentActivity.slice(0, 6).map((act) => (
              <li
                key={act._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 7,
                  flexWrap: 'wrap',
                }}
              >
                <Space size={7} align="center" style={{ minWidth: 0 }}>
                  <Avatar size={20} style={{ backgroundColor: '#cbd5e1', fontSize: 9 }} icon={<UserOutlined />}>
                    {act.user?.fullName?.charAt(0).toUpperCase()}
                  </Avatar>
                  <Text style={{ fontSize: 11.5 }}>
                    <strong>{act.user?.fullName}</strong> {act.action}
                  </Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 10 }} title={formatDateTime(act.createdAt)}>
                  {formatTimeAgo(act.createdAt)}
                </Text>
              </li>
            ))}
          </ul>
          )}
        </Card>
      </section>

      <footer className="dash-footnote">
        <Divider style={{ margin: '0 0 10px' }} />
        <Text type="secondary" style={{ fontSize: 10.5, lineHeight: 1.6 }}>
          Outstanding balances reflect all time and change only when a settlement is completed.
          Spending figures follow the selected filters.
        </Text>
      </footer>

      {/* ══ MODALS — all existing components, unchanged ═══════════ */}
      <ExportExcelModal
        open={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        initialFilters={filters}
        members={members}
        currentUserId={user?._id}
        isExporting={isExporting}
        onExport={handleExport}
      />

      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onExpenseAdded={afterMutation}
        members={memberList}
      />

      <ExpenseDetailModal
        isOpen={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        expense={selectedExpense}
        onEdit={(exp) => {
          setSelectedExpense(null);
          setEditingExpense(exp);
        }}
        onExpenseDeleted={afterMutation}
      />

      <EditExpenseModal
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        expense={editingExpense}
        onExpenseUpdated={afterMutation}
        members={memberList}
      />

      <BreakdownModal
        isOpen={!!breakdownType}
        onClose={() => setBreakdownType(null)}
        title={breakdownType === 'need_to_pay' ? 'People You Owe' : 'People Who Owe You'}
        type={breakdownType || 'need_to_pay'}
        totalAmount={
          breakdownType === 'need_to_pay'
            ? report?.balances?.youNeedToPayTotal || 0
            : report?.balances?.youWillReceiveTotal || 0
        }
        peopleList={breakdownList}
        onMarkAsPaid={(person: OwedPerson) => {
          setBreakdownType(null);
          setSettlementTarget(person);
        }}
      />

      <SettlementModal
        isOpen={!!settlementTarget}
        onClose={() => setSettlementTarget(null)}
        targetPerson={settlementTarget}
        onSettlementUpdated={afterMutation}
      />

      <SettlementDetailsDrawer
        isOpen={!!activeSettlement}
        onClose={() => setActiveSettlement(null)}
        settlement={activeSettlement}
        onSettlementUpdated={afterMutation}
      />

      <UPIDetailModal
        isOpen={!!upiModalUser}
        onClose={() => {
          setUpiModalUser(null);
          setUpiModalAmount(undefined);
        }}
        user={upiModalUser}
        amountToPay={upiModalAmount}
        onPayClick={(u, amt) => {
          setUpiModalUser(null);
          setSettlementTarget({
            user: { _id: u._id, fullName: u.fullName, email: u.email, phone: u.phone },
            amount: amt || 0,
          });
        }}
      />

      <MemberDetailModal
        isOpen={!!detailMember}
        onClose={() => setDetailMember(null)}
        member={detailMember}
      />
    </div>
  );
};

export default Dashboard;
