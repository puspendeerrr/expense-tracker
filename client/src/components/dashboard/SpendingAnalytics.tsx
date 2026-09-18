import React from 'react';
import { Card, Row, Col, Typography, Space, Empty, Progress, Tag, Skeleton, Tooltip } from 'antd';
import { LineChartOutlined, TrophyOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { PeriodSummary, RelationshipRow } from '../../types/reports';
import { formatMoney, MONEY_COLORS } from '../../utils/format';

const { Text } = Typography;

interface SpendingAnalyticsProps {
  summary: PeriodSummary | null;
  topPeopleIPaidFor: { person: string; amount: number }[];
  topPeopleWhoPaidForMe: { person: string; amount: number }[];
  relationships: RelationshipRow[];
  rangeLabel: string;
  isLoading: boolean;
}

const Metric: React.FC<{
  label: string;
  value: string;
  color?: string;
  hint?: string;
}> = ({ label, value, color, hint }) => (
  <div
    style={{
      padding: '10px 12px',
      background: '#f8fafc',
      borderRadius: 10,
      border: '1px solid #e2e8f0',
      height: '100%',
    }}
  >
    <Space size={4} align="center">
      <Text type="secondary" style={{ fontSize: 10.5, fontWeight: 600 }}>{label}</Text>
      {hint && (
        <Tooltip title={hint}>
          <InfoCircleOutlined style={{ fontSize: 10, color: '#94a3b8' }} aria-label={hint} tabIndex={0} />
        </Tooltip>
      )}
    </Space>
    <div className="financial-num" style={{ fontSize: 15, marginTop: 2, color: color || MONEY_COLORS.neutral }}>
      {value}
    </div>
  </div>
);

/** Horizontal ranked bars. Accessible: every bar carries its own value as text. */
const RankedBars: React.FC<{
  title: string;
  rows: { person: string; amount: number }[];
  color: string;
  emptyText: string;
}> = ({ title, rows, color, emptyText }) => {
  const max = rows.length > 0 ? Math.max(...rows.map((r) => r.amount)) : 0;

  return (
    <div>
      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{title}</Text>
      {rows.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 11.5 }}>{emptyText}</Text>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r) => (
            <li key={r.person}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                <Text style={{ fontSize: 11.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.person}
                </Text>
                <Text className="financial-num" style={{ fontSize: 11.5, color, flexShrink: 0 }}>
                  {formatMoney(r.amount)}
                </Text>
              </div>
              <Progress
                percent={max > 0 ? Math.round((r.amount / max) * 100) : 0}
                showInfo={false}
                strokeColor={color}
                trailColor="#f1f5f9"
                size={['100%', 6]}
                aria-label={`${r.person}: ${formatMoney(r.amount)}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * `My Spending` — period-scoped attribution analytics.
 * Every figure here describes spending history; none of it is an outstanding balance.
 */
export const SpendingAnalytics: React.FC<SpendingAnalyticsProps> = ({
  summary,
  topPeopleIPaidFor,
  topPeopleWhoPaidForMe,
  rangeLabel,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card style={{ borderRadius: 14 }} styles={{ body: { padding: 14 } }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  if (!summary || summary.expenseCount === 0) {
    return (
      <Card
        title={
          <Space size={6}>
            <LineChartOutlined style={{ color: MONEY_COLORS.brand }} aria-hidden="true" />
            <span style={{ fontSize: 14 }}>My Spending</span>
          </Space>
        }
        style={{ borderRadius: 14 }}
        styles={{ body: { padding: 12 } }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No financial activity in this period."
          style={{ margin: '20px 0' }}
        />
      </Card>
    );
  }

  // Paid vs share: which side is larger tells the user whether they are subsidising the group.
  const paidVsShareMax = Math.max(summary.totalPaidByMe, summary.myShare, 1);
  const subsidy = Math.round((summary.totalPaidByMe - summary.myShare) * 100) / 100;

  return (
    <Card
      title={
        <Space size={6}>
          <LineChartOutlined style={{ color: MONEY_COLORS.brand }} aria-hidden="true" />
          <span style={{ fontSize: 14 }}>My Spending</span>
        </Space>
      }
      extra={<Tag style={{ margin: 0, fontSize: 10, borderRadius: 4 }}>{rangeLabel}</Tag>}
      style={{ borderRadius: 14 }}
      styles={{ body: { padding: 12 } }}
    >
      <Row gutter={[8, 8]}>
        <Col xs={12} sm={8} md={6}>
          <Metric
            label="TOTAL PAID BY ME"
            value={formatMoney(summary.totalPaidByMe)}
            color={MONEY_COLORS.brand}
            hint="Full bill totals you paid as the payer."
          />
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Metric
            label="ALLOCATED TO ME"
            value={formatMoney(summary.myShare)}
            color="#7c3aed"
            hint="Your stored share across every in-scope expense."
          />
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Metric
            label="PAID FOR OTHERS"
            value={formatMoney(summary.paidForOthers)}
            color={MONEY_COLORS.positive}
            hint="Others' shares of bills you paid. Excludes your own share."
          />
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Metric
            label="OTHERS PAID FOR ME"
            value={formatMoney(summary.paidByOthersForMe)}
            color="#d97706"
            hint="Your share of bills someone else paid."
          />
        </Col>
        <Col xs={8} sm={8} md={6}>
          <Metric label="EXPENSES" value={String(summary.expenseCount)} />
        </Col>
        <Col xs={8} sm={8} md={6}>
          <Metric label="AVERAGE" value={formatMoney(summary.averageExpense)} />
        </Col>
        <Col xs={8} sm={8} md={12}>
          <Metric
            label="LARGEST EXPENSE"
            value={
              summary.largestExpense
                ? `${formatMoney(summary.largestExpense.amount)}`
                : '—'
            }
            hint={summary.largestExpense ? summary.largestExpense.title : undefined}
          />
        </Col>
      </Row>

      {/* Paid vs share comparison */}
      <div style={{ marginTop: 14, padding: '12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
        <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
          Paid vs Your Share
        </Text>

        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={{ fontSize: 11 }}>You paid</Text>
            <Text className="financial-num" style={{ fontSize: 11, color: MONEY_COLORS.brand }}>
              {formatMoney(summary.totalPaidByMe)}
            </Text>
          </div>
          <Progress
            percent={Math.round((summary.totalPaidByMe / paidVsShareMax) * 100)}
            showInfo={false}
            strokeColor={MONEY_COLORS.brand}
            trailColor="#e2e8f0"
            size={['100%', 8]}
            aria-label={`You paid ${formatMoney(summary.totalPaidByMe)}`}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={{ fontSize: 11 }}>Your share</Text>
            <Text className="financial-num" style={{ fontSize: 11, color: '#7c3aed' }}>
              {formatMoney(summary.myShare)}
            </Text>
          </div>
          <Progress
            percent={Math.round((summary.myShare / paidVsShareMax) * 100)}
            showInfo={false}
            strokeColor="#7c3aed"
            trailColor="#e2e8f0"
            size={['100%', 8]}
            aria-label={`Your share ${formatMoney(summary.myShare)}`}
          />
        </div>

        <Text type="secondary" style={{ fontSize: 10.5, display: 'block', marginTop: 8 }}>
          {subsidy > 0
            ? `You fronted ${formatMoney(subsidy)} more than your own share in this period.`
            : subsidy < 0
              ? `Others fronted ${formatMoney(Math.abs(subsidy))} more than you did in this period.`
              : 'You paid exactly your own share in this period.'}{' '}
          This is spending history — see Person-wise Balances for what is actually owed.
        </Text>
      </div>

      {/* Ranked people — only rendered when there is something to rank. */}
      {(topPeopleIPaidFor.length > 0 || topPeopleWhoPaidForMe.length > 0) && (
        <Row gutter={[12, 12]} style={{ marginTop: 14 }}>
          <Col xs={24} md={12}>
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', height: '100%' }}>
              <Space size={5} style={{ marginBottom: 4 }}>
                <TrophyOutlined style={{ fontSize: 11, color: MONEY_COLORS.positive }} aria-hidden="true" />
                <Text type="secondary" style={{ fontSize: 10.5, fontWeight: 600 }}>TOP PEOPLE I PAID FOR</Text>
              </Space>
              <RankedBars
                title=""
                rows={topPeopleIPaidFor}
                color={MONEY_COLORS.positive}
                emptyText="You have not covered anyone's share in this period."
              />
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', height: '100%' }}>
              <Space size={5} style={{ marginBottom: 4 }}>
                <TrophyOutlined style={{ fontSize: 11, color: '#d97706' }} aria-hidden="true" />
                <Text type="secondary" style={{ fontSize: 10.5, fontWeight: 600 }}>TOP PEOPLE WHO PAID FOR ME</Text>
              </Space>
              <RankedBars
                title=""
                rows={topPeopleWhoPaidForMe}
                color="#d97706"
                emptyText="Nobody has covered your share in this period."
              />
            </div>
          </Col>
        </Row>
      )}
    </Card>
  );
};
