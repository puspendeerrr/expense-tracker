import React from 'react';
import { Card, Typography, Space, Button, Tag, Empty, Avatar, Skeleton, Badge } from 'antd';
import {
  BellOutlined, ClockCircleOutlined, CloseCircleOutlined,
  HourglassOutlined, CheckCircleOutlined, UserOutlined,
} from '@ant-design/icons';
import { AttentionBuckets } from '../../types/reports';
import { Settlement } from '../../types';
import { formatMoney, formatTimeAgo, MONEY_COLORS } from '../../utils/format';

const { Text } = Typography;

interface AttentionCenterProps {
  attention: AttentionBuckets | null;
  isLoading: boolean;
  onOpenSettlement: (settlement: Settlement) => void;
}

type Severity = 'action' | 'warning' | 'info';

interface Group {
  key: string;
  title: string;
  severity: Severity;
  icon: React.ReactNode;
  items: Settlement[];
  cta: string;
  describe: (s: Settlement) => string;
}

const SEVERITY_STYLE: Record<Severity, { border: string; bg: string; tag: string }> = {
  action: { border: '#2563eb', bg: '#f0f7ff', tag: 'blue' },
  warning: { border: '#f59e0b', bg: '#fffbeb', tag: 'gold' },
  info: { border: '#e2e8f0', bg: '#f8fafc', tag: 'default' },
};

/**
 * Attention centre. Uses only the existing Settlement statuses — no new status is invented.
 * Every row deep-links into the existing settlement detail flow.
 */
export const AttentionCenter: React.FC<AttentionCenterProps> = ({
  attention,
  isLoading,
  onOpenSettlement,
}) => {
  if (isLoading) {
    return (
      <Card style={{ borderRadius: 14 }} styles={{ body: { padding: 14 } }}>
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    );
  }

  if (!attention) return null;

  const allGroups: Group[] = [
    {
      key: 'awaiting_my_approval',
      title: 'Waiting for your approval',
      severity: 'action',
      icon: <ClockCircleOutlined aria-hidden="true" />,
      items: attention.awaitingMyApproval,
      cta: 'Review',
      describe: (s) => `${s.payer?.fullName || 'Someone'} paid you ${formatMoney(s.amount)} via ${s.paymentMethod === 'cash' ? 'cash' : 'UPI'}`,
    },
    {
      key: 'rejected',
      title: 'Your payment was rejected',
      severity: 'warning',
      icon: <CloseCircleOutlined aria-hidden="true" />,
      items: attention.rejectedNeedingAction,
      cta: 'Fix',
      describe: (s) =>
        `${formatMoney(s.amount)} to ${s.receiver?.fullName || 'someone'}${s.rejectionReason ? ` — ${s.rejectionReason}` : ''}`,
    },
    {
      key: 'my_promises',
      title: 'You promised to pay',
      severity: 'warning',
      icon: <HourglassOutlined aria-hidden="true" />,
      items: attention.myPromises,
      cta: 'Pay',
      describe: (s) => `${formatMoney(s.amount)} to ${s.receiver?.fullName || 'someone'}`,
    },
    {
      key: 'awaiting_their_approval',
      title: 'Awaiting their confirmation',
      severity: 'info',
      icon: <CheckCircleOutlined aria-hidden="true" />,
      items: attention.awaitingTheirApproval,
      cta: 'View',
      describe: (s) => `${formatMoney(s.amount)} sent to ${s.receiver?.fullName || 'someone'}`,
    },
    {
      key: 'promises_to_me',
      title: 'Promised to you',
      severity: 'info',
      icon: <HourglassOutlined aria-hidden="true" />,
      items: attention.promisesToMe,
      cta: 'View',
      describe: (s) => `${s.payer?.fullName || 'Someone'} will pay ${formatMoney(s.amount)} soon`,
    },
  ];

  const groups = allGroups.filter((g) => g.items.length > 0);

  const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <Card
      title={
        <Space size={6}>
          <BellOutlined style={{ color: attention.totalActionable > 0 ? '#f59e0b' : MONEY_COLORS.brand }} aria-hidden="true" />
          <span style={{ fontSize: 14 }}>Pending Actions</span>
          {attention.totalActionable > 0 && (
            <Badge
              count={attention.totalActionable}
              style={{ backgroundColor: '#e11d48' }}
              aria-label={`${attention.totalActionable} items need your action`}
            />
          )}
        </Space>
      }
      style={{
        borderRadius: 14,
        borderColor: attention.totalActionable > 0 ? '#fcd34d' : undefined,
      }}
      styles={{ body: { padding: 12 } }}
    >
      {totalItems === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Nothing needs your attention right now."
          style={{ margin: '12px 0' }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.map((group) => {
            const style = SEVERITY_STYLE[group.severity];
            return (
              <section key={group.key} aria-label={group.title}>
                <Space size={5} style={{ marginBottom: 6 }}>
                  <span style={{ color: style.border, fontSize: 12 }}>{group.icon}</span>
                  <Text strong style={{ fontSize: 12 }}>{group.title}</Text>
                  <Tag color={style.tag} style={{ margin: 0, fontSize: 10, borderRadius: 4 }}>
                    {group.items.length}
                  </Tag>
                </Space>

                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {group.items.slice(0, 5).map((s) => (
                    <li
                      key={s._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '8px 10px',
                        background: style.bg,
                        border: `1px solid ${group.severity === 'info' ? '#e2e8f0' : style.border}`,
                        borderRadius: 9,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Space size={8} align="center" style={{ minWidth: 0, flex: '1 1 180px' }}>
                        <Avatar size={26} style={{ backgroundColor: '#0f172a', flexShrink: 0 }} icon={<UserOutlined />} />
                        <div style={{ minWidth: 0 }}>
                          <Text style={{ fontSize: 12, display: 'block', lineHeight: 1.3 }}>
                            {group.describe(s)}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 10 }}>
                            {formatTimeAgo(s.createdAt)}
                          </Text>
                        </div>
                      </Space>

                      <Button
                        size="small"
                        type={group.severity === 'action' ? 'primary' : 'default'}
                        onClick={() => onOpenSettlement(s)}
                        style={{ borderRadius: 8, flexShrink: 0 }}
                        aria-label={`${group.cta} settlement of ${formatMoney(s.amount)}`}
                      >
                        {group.cta}
                      </Button>
                    </li>
                  ))}
                  {group.items.length > 5 && (
                    <li>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        +{group.items.length - 5} more in Settlement History
                      </Text>
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
};
