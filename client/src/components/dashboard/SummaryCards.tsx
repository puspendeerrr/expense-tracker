import React from 'react';
import { Row, Col, Card, Typography, Space, Tag, Tooltip, Skeleton } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  WalletOutlined,
  PieChartOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { ReportBalances, PeriodSummary } from '../../types/reports';
import { formatMoney, formatSignedMoney, MONEY_COLORS } from '../../utils/format';

const { Text } = Typography;

interface SummaryCardsProps {
  balances: ReportBalances | null;
  periodSummary: PeriodSummary | null;
  rangeLabel: string;
  isLoading: boolean;
  onOpenPayables: () => void;
  onOpenReceivables: () => void;
}

interface StatCardProps {
  label: string;
  value: string;
  valueColor?: string;
  caption?: React.ReactNode;
  icon?: React.ReactNode;
  tooltip?: string;
  onClick?: () => void;
  accent?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label, value, valueColor, caption, icon, tooltip, onClick, accent,
}) => {
  const interactive = typeof onClick === 'function';

  return (
    <Card
      hoverable={interactive}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `${label}: ${value}. Activate to view the breakdown.` : `${label}: ${value}`}
      style={{
        borderRadius: 14,
        height: '100%',
        cursor: interactive ? 'pointer' : 'default',
        borderLeft: accent ? `3px solid ${accent}` : undefined,
      }}
      styles={{ body: { padding: 14 } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <Space size={5} align="center">
          {icon}
          <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
            {label}
          </Text>
        </Space>
        {tooltip && (
          <Tooltip title={tooltip}>
            <InfoCircleOutlined
              style={{ fontSize: 11, color: '#94a3b8' }}
              aria-label={tooltip}
              tabIndex={0}
            />
          </Tooltip>
        )}
      </div>

      <div
        className="financial-num"
        style={{ fontSize: 20, marginTop: 4, color: valueColor || MONEY_COLORS.neutral, lineHeight: 1.25 }}
      >
        {value}
      </div>

      {caption && (
        <div style={{ marginTop: 3 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>{caption}</Text>
        </div>
      )}
    </Card>
  );
};

const LoadingCard: React.FC = () => (
  <Card style={{ borderRadius: 14, height: '100%' }} styles={{ body: { padding: 14 } }}>
    <Skeleton active paragraph={{ rows: 1, width: '70%' }} title={{ width: '45%' }} />
  </Card>
);

/**
 * The top-level position row.
 *
 * Cards 1-3 are live OBLIGATIONS straight from the server's balance engine — never recomputed
 * here. Cards 4-5 are period-scoped spending ATTRIBUTION and are labelled so they cannot be
 * mistaken for debts.
 */
export const SummaryCards: React.FC<SummaryCardsProps> = ({
  balances,
  periodSummary,
  rangeLabel,
  isLoading,
  onOpenPayables,
  onOpenReceivables,
}) => {
  if (isLoading || !balances || !periodSummary) {
    return (
      <Row gutter={[10, 10]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Col key={i} xs={12} sm={12} md={8} lg={{ flex: '1 1 20%' }}>
            <LoadingCard />
          </Col>
        ))}
      </Row>
    );
  }

  const net = balances.netBalance;

  return (
    <Row gutter={[10, 10]}>
      <Col xs={24} sm={12} md={8} lg={{ flex: '1 1 20%' }}>
        <StatCard
          label="NET BALANCE"
          value={formatSignedMoney(net)}
          valueColor={net > 0 ? MONEY_COLORS.positive : net < 0 ? MONEY_COLORS.negative : MONEY_COLORS.neutral}
          accent={net > 0 ? MONEY_COLORS.positive : net < 0 ? MONEY_COLORS.negative : '#cbd5e1'}
          icon={<WalletOutlined style={{ fontSize: 12, color: MONEY_COLORS.brand }} aria-hidden="true" />}
          caption={
            net > 0 ? 'Flatmates owe you overall'
              : net < 0 ? 'You have pending dues'
                : 'All balances settled'
          }
          tooltip="Your overall live position across all time. Only completed settlements change this."
        />
      </Col>

      <Col xs={12} sm={12} md={8} lg={{ flex: '1 1 20%' }}>
        <StatCard
          label="YOU NEED TO PAY"
          value={formatMoney(balances.youNeedToPayTotal)}
          valueColor={MONEY_COLORS.negative}
          accent={MONEY_COLORS.negative}
          icon={<ArrowDownOutlined style={{ fontSize: 12, color: MONEY_COLORS.negative }} aria-hidden="true" />}
          caption={
            <>
              {balances.peopleIOweCount} {balances.peopleIOweCount === 1 ? 'person' : 'people'} · view breakdown
            </>
          }
          onClick={onOpenPayables}
          tooltip="Current outstanding amount you owe, across all time."
        />
      </Col>

      <Col xs={12} sm={12} md={8} lg={{ flex: '1 1 20%' }}>
        <StatCard
          label="YOU WILL RECEIVE"
          value={formatMoney(balances.youWillReceiveTotal)}
          valueColor={MONEY_COLORS.positive}
          accent={MONEY_COLORS.positive}
          icon={<ArrowUpOutlined style={{ fontSize: 12, color: MONEY_COLORS.positive }} aria-hidden="true" />}
          caption={
            <>
              {balances.peopleWhoOweMeCount} {balances.peopleWhoOweMeCount === 1 ? 'person' : 'people'} · view breakdown
            </>
          }
          onClick={onOpenReceivables}
          tooltip="Current outstanding amount owed to you, across all time."
        />
      </Col>

      <Col xs={12} sm={12} md={12} lg={{ flex: '1 1 20%' }}>
        <StatCard
          label="TOTAL PAID"
          value={formatMoney(periodSummary.totalPaidByMe)}
          valueColor={MONEY_COLORS.brand}
          accent={MONEY_COLORS.brand}
          icon={<PieChartOutlined style={{ fontSize: 12, color: MONEY_COLORS.brand }} aria-hidden="true" />}
          caption={rangeLabel}
          tooltip="Bill totals you personally paid in the selected period. This is spending history, not an amount anyone owes you."
        />
      </Col>

      <Col xs={12} sm={12} md={12} lg={{ flex: '1 1 20%' }}>
        <StatCard
          label="YOUR SHARE"
          value={formatMoney(periodSummary.myShare)}
          valueColor="#7c3aed"
          accent="#7c3aed"
          icon={<PieChartOutlined style={{ fontSize: 12, color: '#7c3aed' }} aria-hidden="true" />}
          caption={rangeLabel}
          tooltip="The portion of expenses allocated to you in the selected period, from each expense's stored split. This is your consumption, not a debt."
        />
      </Col>
    </Row>
  );
};
