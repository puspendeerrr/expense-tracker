import React from 'react';
import { Typography, Space, Button, Tag, Tooltip, Badge } from 'antd';
import {
  FileExcelOutlined, CalendarOutlined, ReloadOutlined,
  SyncOutlined, PlusOutlined, WifiOutlined,
} from '@ant-design/icons';
import { BillingCycle } from '../../types';
import { formatDateShort, formatTimeAgo, MONEY_COLORS } from '../../utils/format';

const { Title, Text } = Typography;

interface DashboardHeaderProps {
  groupName: string;
  billingCycle: BillingCycle | null;
  lastUpdated: Date | null;
  isRefreshing: boolean;
  isLive: boolean;
  onExport: () => void;
  onRefresh: () => void;
  onAddExpense: () => void;
}

/**
 * Section A — dashboard header.
 * The export action is above the fold on every breakpoint: a labelled button on tablet and up,
 * a tooltipped icon button on phones so the header never overcrowds.
 */
export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  groupName,
  billingCycle,
  lastUpdated,
  isRefreshing,
  isLive,
  onExport,
  onRefresh,
  onAddExpense,
}) => {
  const cycle = billingCycle && billingCycle.payday ? billingCycle : null;

  return (
    <header className="dash-header" aria-label={`Financial dashboard for ${groupName}`}>
      <div style={{ minWidth: 0 }}>
        <Space size={8} align="center" wrap>
          <Title level={4} style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>
            Financial Dashboard
          </Title>
          <Tooltip title={isLive ? 'Live updates connected' : 'Live updates offline — pull to refresh'}>
            <Badge
              status={isLive ? 'success' : 'default'}
              text={
                <Text type="secondary" style={{ fontSize: 10.5 }}>
                  {isLive ? 'Live' : 'Offline'}
                </Text>
              }
            />
          </Tooltip>
        </Space>

        {/* The group name is already in the navbar on every breakpoint, so it is not
            repeated here — this row carries only cycle and freshness. */}
        <div style={{ marginTop: 2 }}>
          <Space size={8} wrap>
            {cycle && (
              <Tag
                icon={<CalendarOutlined aria-hidden="true" />}
                color={cycle.isPaydayToday ? 'gold' : 'blue'}
                style={{ margin: 0, fontSize: 10.5, borderRadius: 6 }}
              >
                {cycle.isPaydayToday
                  ? 'Today is Payday'
                  : `Cycle ${formatDateShort(cycle.startDate)} – ${formatDateShort(cycle.endDate)} · ${cycle.daysRemaining}d left`}
              </Tag>
            )}

            {lastUpdated && (
              <Text type="secondary" style={{ fontSize: 10.5 }}>
                {isRefreshing ? (
                  <>
                    <SyncOutlined spin style={{ fontSize: 9, marginRight: 3 }} aria-hidden="true" />
                    Syncing…
                  </>
                ) : (
                  <>Updated {formatTimeAgo(lastUpdated)}</>
                )}
              </Text>
            )}
          </Space>
        </div>
      </div>

      <Space size={8} className="dash-header__actions">
        <Tooltip title="Refresh dashboard data">
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            loading={isRefreshing}
            style={{ borderRadius: 10 }}
            aria-label="Refresh dashboard data"
          />
        </Tooltip>

        {/* Desktop / tablet: full label. */}
        <Button
          className="dash-export-btn--wide"
          icon={<FileExcelOutlined />}
          onClick={onExport}
          style={{ borderRadius: 10, fontWeight: 600, borderColor: '#16a34a', color: '#16a34a' }}
        >
          Export Excel
        </Button>

        {/* Phones: icon only, still above the fold. */}
        <Tooltip title="Export Excel report">
          <Button
            className="dash-export-btn--compact"
            icon={<FileExcelOutlined />}
            onClick={onExport}
            style={{ borderRadius: 10, borderColor: '#16a34a', color: '#16a34a' }}
            aria-label="Export Excel report"
          />
        </Tooltip>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onAddExpense}
          style={{ borderRadius: 10, background: MONEY_COLORS.brand, fontWeight: 600 }}
        >
          <span className="dash-btn-label">Add Expense</span>
        </Button>
      </Space>
    </header>
  );
};
