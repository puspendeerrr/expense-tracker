import React, { useState, useEffect } from 'react';
import { Drawer, Select, DatePicker, Button, Space, Tag, Tooltip, Typography, Badge, Divider, Grid } from 'antd';
import { FilterOutlined, ClearOutlined, CalendarOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  ReportFilters,
  DatePreset,
  PRESET_LABELS,
  INVOLVEMENT_LABELS,
  PAYMENT_MODE_LABELS,
  PaymentModeFilter,
  InvolvementFilter,
  toLocalDateString,
  isRangeIncomplete,
  DEFAULT_FILTERS,
} from '../../hooks/useReportFilters';
import { ReportPerson } from '../../types/reports';

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface ReportFilterBarProps {
  filters: ReportFilters;
  onChange: <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => void;
  /** Applies a whole filter set at once, so the drawer costs exactly one refetch. */
  onApply: (next: ReportFilters) => void;
  onReset: () => void;
  members: ReportPerson[];
  currentUserId?: string;
  rangeLabel: string;
  activeCount: number;
  disabled?: boolean;
  /** What the current filters actually yield — fills the row instead of leaving dead space. */
  summary?: { expenseCount: number; totalExpense: number } | null;
}

const PRESET_OPTIONS: { label: string; value: DatePreset }[] = [
  'today', 'this_week', 'this_month', 'last_month', 'last_30_days', 'this_year', 'all_time', 'custom',
].map((v) => ({ label: PRESET_LABELS[v as DatePreset], value: v as DatePreset }));

/**
 * Compact filter control.
 *
 * The controls live in a side drawer behind a single chip, so the dashboard keeps its full width
 * on a phone instead of spending four rows on selects. Changes inside the drawer are staged and
 * committed on Apply — one refetch per adjustment session rather than one per tap, which matters
 * on mobile data. Removing a chip is a single deliberate action and applies immediately.
 */
export const ReportFilterBar: React.FC<ReportFilterBarProps> = ({
  filters,
  onChange,
  onApply,
  onReset,
  members,
  currentUserId,
  rangeLabel,
  activeCount,
  disabled = false,
  summary = null,
}) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ReportFilters>(filters);

  // Re-seed the draft each time the drawer opens so it always mirrors what is applied.
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const setDraftValue = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const memberOptions = React.useMemo(
    () => [
      { label: 'All Members', value: 'all' },
      ...members.filter((m) => m._id !== currentUserId).map((m) => ({ label: m.fullName, value: m._id })),
    ],
    [members, currentUserId]
  );

  const memberName = (id: string) =>
    members.find((m) => m._id === id)?.fullName || 'Member';

  const incomplete = isRangeIncomplete(draft);

  const draftDirty =
    draft.preset !== filters.preset ||
    draft.customFrom !== filters.customFrom ||
    draft.customTo !== filters.customTo ||
    draft.memberId !== filters.memberId ||
    draft.paymentMode !== filters.paymentMode ||
    draft.involvement !== filters.involvement;

  const handleApply = () => {
    onApply(draft);
    setOpen(false);
  };

  const customValue: [Dayjs, Dayjs] | null =
    draft.customFrom && draft.customTo ? [dayjs(draft.customFrom), dayjs(draft.customTo)] : null;

  const handleRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (!dates || !dates[0] || !dates[1]) {
      setDraft((prev) => ({ ...prev, customFrom: null, customTo: null }));
      return;
    }
    setDraft((prev) => ({
      ...prev,
      customFrom: toLocalDateString(dates[0]!.toDate()),
      customTo: toLocalDateString(dates[1]!.toDate()),
    }));
  };

  const field = (label: string, control: React.ReactNode, hint?: string) => (
    <div style={{ marginBottom: 16 }}>
      <Text strong style={{ fontSize: 12.5, display: 'block', marginBottom: 5 }}>{label}</Text>
      {control}
      {hint && (
        <Text type="secondary" style={{ fontSize: 10.5, display: 'block', marginTop: 4 }}>{hint}</Text>
      )}
    </div>
  );

  return (
    <>
      {/* ── Compact trigger row ───────────────────────────────── */}
      <div className="dash-filterbar-row">
        <div className="dash-filterbar" role="group" aria-label="Report filters">
          <Badge count={activeCount} size="small" offset={[-2, 2]}>
            <Button
              icon={<FilterOutlined />}
              onClick={() => setOpen(true)}
              disabled={disabled}
              className="dash-filterbar__trigger"
              aria-label={`Open filters. ${activeCount} filter${activeCount === 1 ? '' : 's'} active.`}
            >
              Filters
            </Button>
          </Badge>

          <div className="dash-filterbar__chips">
            {/* Period is always present, so it is a tappable shortcut rather than a removable chip. */}
            <Tag
              icon={<CalendarOutlined aria-hidden="true" />}
              color="processing"
              onClick={() => !disabled && setOpen(true)}
              style={{ margin: 0, cursor: disabled ? 'default' : 'pointer', borderRadius: 14, fontSize: 11.5, padding: '2px 10px' }}
            >
              {rangeLabel}
            </Tag>

            {filters.memberId !== 'all' && (
              <Tag
                closable
                onClose={(e) => { e.preventDefault(); onChange('memberId', 'all'); }}
                onClick={() => !disabled && setOpen(true)}
                color="blue"
                style={{ margin: 0, cursor: 'pointer', borderRadius: 14, fontSize: 11.5, padding: '2px 8px' }}
                aria-label={`Person filter: ${memberName(filters.memberId)}. Remove.`}
              >
                {memberName(filters.memberId)}
              </Tag>
            )}

            {filters.paymentMode !== 'all' && (
              <Tag
                closable
                onClose={(e) => { e.preventDefault(); onChange('paymentMode', 'all'); }}
                onClick={() => !disabled && setOpen(true)}
                color="cyan"
                style={{ margin: 0, cursor: 'pointer', borderRadius: 14, fontSize: 11.5, padding: '2px 8px' }}
                aria-label={`Payment filter: ${PAYMENT_MODE_LABELS[filters.paymentMode]}. Remove.`}
              >
                {PAYMENT_MODE_LABELS[filters.paymentMode]}
              </Tag>
            )}

            {filters.involvement !== 'all' && (
              <Tag
                closable
                onClose={(e) => { e.preventDefault(); onChange('involvement', 'all'); }}
                onClick={() => !disabled && setOpen(true)}
                color="purple"
                style={{ margin: 0, cursor: 'pointer', borderRadius: 14, fontSize: 11.5, padding: '2px 8px' }}
                aria-label={`Involvement filter: ${INVOLVEMENT_LABELS[filters.involvement]}. Remove.`}
              >
                {INVOLVEMENT_LABELS[filters.involvement]}
              </Tag>
            )}
          </div>

          {activeCount > 0 && (
            <Tooltip title="Reset all filters">
              <Button
                type="text"
                size="small"
                icon={<ClearOutlined />}
                onClick={onReset}
                disabled={disabled}
                className="dash-filterbar__reset"
                aria-label="Reset all filters"
              />
            </Tooltip>
          )}
        </div>

        {/* Right side of the row: what this filter selection actually returns. */}
        {summary && (
          <div className="dash-filterbar__summary" aria-live="polite">
            {summary.expenseCount > 0 ? (
              <>
                <Text type="secondary" style={{ fontSize: 11.5 }}>Showing</Text>
                <Text strong style={{ fontSize: 12.5 }}>
                  {summary.expenseCount} {summary.expenseCount === 1 ? 'expense' : 'expenses'}
                </Text>
                <span className="dash-filterbar__summary-sep" aria-hidden="true">·</span>
                <Text
                  strong
                  className="financial-num"
                  style={{ fontSize: 12.5, color: '#2563eb' }}
                >
                  {`₹${summary.totalExpense.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
                </Text>
              </>
            ) : (
              <Text type="secondary" style={{ fontSize: 11.5 }}>
                No expenses in this period
              </Text>
            )}
          </div>
        )}
      </div>

      {/* ── Filter sidebar ────────────────────────────────────── */}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        placement="right"
        width={isMobile ? '88%' : 380}
        title={
          <Space size={7} align="center">
            <FilterOutlined style={{ color: '#2563eb' }} aria-hidden="true" />
            <span style={{ fontSize: 15 }}>Filters</span>
            {activeCount > 0 && (
              <Tag color="blue" style={{ margin: 0, fontSize: 10.5, borderRadius: 4 }}>
                {activeCount} active
              </Tag>
            )}
          </Space>
        }
        styles={{ body: { padding: '16px 18px' }, footer: { padding: '12px 18px' } }}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              onClick={() => setDraft({ ...DEFAULT_FILTERS })}
              icon={<ClearOutlined />}
              style={{ borderRadius: 9, flex: '0 0 auto' }}
            >
              Reset
            </Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleApply}
              disabled={incomplete}
              style={{ borderRadius: 9, flex: 1, background: '#2563eb' }}
            >
              {draftDirty ? 'Apply Filters' : 'Done'}
            </Button>
          </div>
        }
      >
        {field(
          'Period',
          <Select
            value={draft.preset}
            onChange={(v) => setDraftValue('preset', v)}
            options={PRESET_OPTIONS}
            size="large"
            style={{ width: '100%' }}
            aria-label="Date range preset"
          />
        )}

        {draft.preset === 'custom' &&
          field(
            'Custom Range',
            <DatePicker.RangePicker
              value={customValue}
              onChange={handleRangeChange as never}
              allowClear
              size="large"
              format="DD MMM YYYY"
              style={{ width: '100%' }}
              inputReadOnly={isMobile}
              disabledDate={(d) => d && d.isAfter(dayjs().endOf('day'))}
              aria-label="Custom date range"
            />,
            incomplete ? 'Pick both a start and an end date.' : undefined
          )}

        <Divider style={{ margin: '4px 0 16px' }} />

        {field(
          'Person',
          <Select
            value={draft.memberId}
            onChange={(v) => setDraftValue('memberId', v)}
            options={memberOptions}
            size="large"
            style={{ width: '100%' }}
            showSearch
            optionFilterProp="label"
            aria-label="Filter by member"
          />,
          'Limits expenses and the relationship table to one flatmate.'
        )}

        {field(
          'Payment',
          <Select
            value={draft.paymentMode}
            onChange={(v) => setDraftValue('paymentMode', v as PaymentModeFilter)}
            options={[
              { label: PAYMENT_MODE_LABELS.all, value: 'all' },
              { label: PAYMENT_MODE_LABELS.cash, value: 'cash' },
              { label: PAYMENT_MODE_LABELS.upi, value: 'upi' },
            ]}
            size="large"
            style={{ width: '100%' }}
            aria-label="Filter by payment mode"
          />
        )}

        {field(
          'Involvement',
          <Select
            value={draft.involvement}
            onChange={(v) => setDraftValue('involvement', v as InvolvementFilter)}
            options={[
              { label: INVOLVEMENT_LABELS.all, value: 'all' },
              { label: INVOLVEMENT_LABELS.involving_me, value: 'involving_me' },
              { label: INVOLVEMENT_LABELS.paid_by_me, value: 'paid_by_me' },
              { label: INVOLVEMENT_LABELS.paid_by_others_for_me, value: 'paid_by_others_for_me' },
            ]}
            size="large"
            style={{ width: '100%' }}
            aria-label="Filter by expense involvement"
          />,
          'Which expenses count towards your spending figures.'
        )}

        <div
          style={{
            marginTop: 4,
            padding: '10px 12px',
            background: '#f8fafc',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
          }}
        >
          <Text type="secondary" style={{ fontSize: 10.5, lineHeight: 1.55 }}>
            Filters scope your <strong>spending analytics</strong> and the Excel export.
            Outstanding balances always reflect all time, because a debt does not change when you
            change the date range.
          </Text>
        </div>
      </Drawer>
    </>
  );
};
