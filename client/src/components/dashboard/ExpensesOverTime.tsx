import React, { useState, useMemo } from 'react';
import { Card, Typography, Space, Empty, Segmented, Tag, Skeleton, Drawer, List, Avatar, Tooltip, Grid } from 'antd';
import { BarChartOutlined, CalendarOutlined, MobileOutlined, DollarCircleOutlined } from '@ant-design/icons';
import { PeriodBucket, RecentExpenseRow } from '../../types/reports';
import { Expense } from '../../types';
import { formatMoney, formatMoneyCompact, formatDate, MONEY_COLORS } from '../../utils/format';

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface ExpensesOverTimeProps {
  buckets: PeriodBucket[];
  grouping: 'day' | 'week' | 'month';
  totalExpense: number;
  rangeLabel: string;
  isLoading: boolean;
  onGroupingChange: (value: 'auto' | 'day' | 'week' | 'month') => void;
  activeGrouping: 'auto' | 'day' | 'week' | 'month';
  onLoadBucketExpenses: (bucket: PeriodBucket) => Promise<Expense[]>;
  onSelectExpense: (expense: Expense) => void;
}

const GROUPING_LABEL: Record<string, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly' };

/**
 * `Expenses Over Time`.
 *
 * The bars render the server's period buckets verbatim — no client-side re-aggregation — so the
 * chart total always reconciles with the filtered dataset and the exported breakdown sheet.
 */
export const ExpensesOverTime: React.FC<ExpensesOverTimeProps> = ({
  buckets,
  grouping,
  totalExpense,
  rangeLabel,
  isLoading,
  onGroupingChange,
  activeGrouping,
  onLoadBucketExpenses,
  onSelectExpense,
}) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [drillBucket, setDrillBucket] = useState<PeriodBucket | null>(null);
  const [drillExpenses, setDrillExpenses] = useState<Expense[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const maxValue = useMemo(
    () => (buckets.length > 0 ? Math.max(...buckets.map((b) => b.totalExpense)) : 0),
    [buckets]
  );

  // Reconciliation guard: the bars must add up to the headline figure.
  const barSum = useMemo(
    () => Math.round(buckets.reduce((acc, b) => acc + b.totalExpense * 100, 0)) / 100,
    [buckets]
  );
  const reconciles = Math.round(barSum * 100) === Math.round(totalExpense * 100);

  const openDrill = async (bucket: PeriodBucket) => {
    setDrillBucket(bucket);
    setDrillLoading(true);
    try {
      const rows = await onLoadBucketExpenses(bucket);
      setDrillExpenses(rows);
    } finally {
      setDrillLoading(false);
    }
  };

  const closeDrill = () => {
    setDrillBucket(null);
    setDrillExpenses([]);
  };

  const groupingControl = (block: boolean) => (
    <Segmented
      size="small"
      block={block}
      value={activeGrouping}
      onChange={(v) => onGroupingChange(v as 'auto' | 'day' | 'week' | 'month')}
      options={[
        { label: 'Auto', value: 'auto' },
        { label: 'Day', value: 'day' },
        { label: 'Week', value: 'week' },
        { label: 'Month', value: 'month' },
      ]}
      aria-label="Chart grouping granularity"
    />
  );

  const body = () => {
    if (isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;

    if (buckets.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No expenses found for this date range."
          style={{ margin: '20px 0' }}
        />
      );
    }

    return (
      <>
        <div
          className="dash-timechart"
          role="img"
          aria-label={`${GROUPING_LABEL[grouping]} expense totals for ${rangeLabel}. ${buckets
            .map((b) => `${b.label}: ${formatMoney(b.totalExpense)}`)
            .join('. ')}`}
        >
          {buckets.map((b) => {
            const heightPct = maxValue > 0 ? Math.max(2, (b.totalExpense / maxValue) * 100) : 2;
            return (
              <Tooltip
                key={b.key}
                title={
                  <div style={{ fontSize: 12 }}>
                    <div><strong>{b.label}</strong></div>
                    <div>Total: {formatMoney(b.totalExpense)}</div>
                    <div>Paid by me: {formatMoney(b.paidByMe)}</div>
                    <div>My share: {formatMoney(b.myShare)}</div>
                    <div>{b.expenseCount} {b.expenseCount === 1 ? 'expense' : 'expenses'}</div>
                  </div>
                }
              >
                <button
                  type="button"
                  className="dash-timechart__col"
                  onClick={() => openDrill(b)}
                  aria-label={`${b.label}: ${formatMoney(b.totalExpense)}, ${b.expenseCount} expenses. Activate to view them.`}
                >
                  <span className="dash-timechart__value">
                    {b.totalExpense > 0 ? formatMoneyCompact(b.totalExpense) : ''}
                  </span>
                  <span
                    className="dash-timechart__bar"
                    style={{
                      height: `${heightPct}%`,
                      background:
                        b.totalExpense === 0
                          ? '#e2e8f0'
                          : `linear-gradient(180deg, #3b82f6 0%, ${MONEY_COLORS.brand} 100%)`,
                    }}
                  />
                  <span className="dash-timechart__label">{b.label}</span>
                </button>
              </Tooltip>
            );
          })}
        </div>

        {/* Textual summary keeps the chart usable without sight of the bars. */}
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          <Text type="secondary" style={{ fontSize: 11 }}>
            {buckets.length} {GROUPING_LABEL[grouping].toLowerCase().replace('ly', '')} periods · tap a bar to drill in
          </Text>
          <Text style={{ fontSize: 11.5 }}>
            Period total:{' '}
            <strong className="financial-num" style={{ color: MONEY_COLORS.brand }}>
              {formatMoney(barSum)}
            </strong>
            {!reconciles && (
              <Tag color="error" style={{ marginLeft: 6, fontSize: 10 }}>
                mismatch vs {formatMoney(totalExpense)}
              </Tag>
            )}
          </Text>
        </div>
      </>
    );
  };

  return (
    <>
      <Card
        title={
          <Space size={6}>
            <BarChartOutlined style={{ color: MONEY_COLORS.brand }} aria-hidden="true" />
            <span style={{ fontSize: 14 }}>Expenses Over Time</span>
          </Space>
        }
        // On a phone the 4-option control would squeeze the title, so it moves into the body
        // as a full-width row instead.
        extra={isMobile ? undefined : groupingControl(false)}
        style={{ borderRadius: 14 }}
        styles={{ body: { padding: 12 } }}
      >
        {isMobile && <div style={{ marginBottom: 10 }}>{groupingControl(true)}</div>}
        {body()}
      </Card>

      <Drawer
        open={!!drillBucket}
        onClose={closeDrill}
        placement={isMobile ? 'bottom' : 'right'}
        height={isMobile ? '78%' : undefined}
        width={isMobile ? '100%' : 440}
        title={
          <Space size={6}>
            <CalendarOutlined style={{ color: MONEY_COLORS.brand }} aria-hidden="true" />
            <span style={{ fontSize: 14 }}>{drillBucket?.label}</span>
          </Space>
        }
      >
        {drillBucket && (
          <div style={{ marginBottom: 14, padding: 12, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Total</Text>
                <Text strong className="financial-num" style={{ fontSize: 13 }}>{formatMoney(drillBucket.totalExpense)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Paid by me</Text>
                <Text className="financial-num" style={{ fontSize: 12.5, color: MONEY_COLORS.brand }}>{formatMoney(drillBucket.paidByMe)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>My share</Text>
                <Text className="financial-num" style={{ fontSize: 12.5, color: '#7c3aed' }}>{formatMoney(drillBucket.myShare)}</Text>
              </div>
            </Space>
          </div>
        )}

        {drillLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : drillExpenses.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No expenses in this period." />
        ) : (
          <List
            dataSource={drillExpenses}
            renderItem={(exp) => (
              <List.Item
                onClick={() => { closeDrill(); onSelectExpense(exp); }}
                style={{ cursor: 'pointer', padding: '10px 4px' }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size={34}
                      style={{
                        backgroundColor: exp.paymentMode === 'upi' ? '#eff6ff' : '#f0fdf4',
                        color: exp.paymentMode === 'upi' ? MONEY_COLORS.brand : MONEY_COLORS.positive,
                      }}
                      icon={exp.paymentMode === 'upi' ? <MobileOutlined /> : <DollarCircleOutlined />}
                    />
                  }
                  title={<Text strong style={{ fontSize: 13 }}>{exp.title}</Text>}
                  description={
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Paid by {exp.paidBy?.fullName} · {formatDate(exp.date)}
                    </Text>
                  }
                />
                <Text strong className="financial-num" style={{ fontSize: 13 }}>
                  {formatMoney(exp.amount)}
                </Text>
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </>
  );
};
