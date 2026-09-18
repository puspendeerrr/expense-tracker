import React from 'react';
import { Card, Typography, Space, Button, Tag, Empty, Avatar, Skeleton, Tooltip } from 'antd';
import {
  HistoryOutlined, MobileOutlined, DollarCircleOutlined,
  FileImageOutlined, TeamOutlined, RightOutlined,
} from '@ant-design/icons';
import { RecentExpenseRow } from '../../types/reports';
import { formatMoney, formatDate, formatTimeAgo, MONEY_COLORS } from '../../utils/format';

const { Text } = Typography;

interface RecentExpensesListProps {
  expenses: RecentExpenseRow[];
  isLoading: boolean;
  rangeLabel: string;
  onSelect: (expenseId: string) => void;
  onViewAll: () => void;
}

const INVOLVEMENT_TAG: Record<string, { label: string; color: string }> = {
  paid_by_me: { label: 'You paid', color: 'blue' },
  paid_by_others_for_me: { label: 'Paid for you', color: 'purple' },
  not_involved: { label: 'Not involved', color: 'default' },
};

/**
 * Recent expenses for the selected scope.
 * The server already caps this list, so no oversized fetch happens to render a handful of rows.
 */
export const RecentExpensesList: React.FC<RecentExpensesListProps> = ({
  expenses,
  isLoading,
  rangeLabel,
  onSelect,
  onViewAll,
}) => (
  <Card
    title={
      <Space size={6}>
        <HistoryOutlined style={{ color: MONEY_COLORS.brand }} aria-hidden="true" />
        <span style={{ fontSize: 14 }}>Recent Expenses</span>
      </Space>
    }
    extra={
      <Button
        type="link"
        size="small"
        onClick={onViewAll}
        style={{ fontSize: 12, padding: 0, fontWeight: 600 }}
      >
        View All Expenses <RightOutlined style={{ fontSize: 9 }} aria-hidden="true" />
      </Button>
    }
    style={{ borderRadius: 14 }}
    styles={{ body: { padding: 12 } }}
  >
    {isLoading ? (
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} active avatar paragraph={{ rows: 1 }} title={{ width: '40%' }} />
        ))}
      </Space>
    ) : expenses.length === 0 ? (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={`No expenses found for ${rangeLabel.toLowerCase()}.`}
        style={{ margin: '16px 0' }}
      />
    ) : (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {expenses.map((exp) => {
          const involvement = INVOLVEMENT_TAG[exp.involvement] || INVOLVEMENT_TAG.not_involved;

          return (
            <li key={exp._id}>
              <button
                type="button"
                onClick={() => onSelect(exp._id)}
                className="dash-row-button"
                aria-label={`${exp.title}, ${formatMoney(exp.amount)}, paid by ${exp.paidBy?.fullName}. Your share ${formatMoney(exp.myShare)}. Open details.`}
              >
                <Space size={10} align="center" style={{ minWidth: 0, flex: '1 1 auto' }}>
                  <Avatar
                    size={36}
                    style={{
                      backgroundColor: exp.paymentMode === 'upi' ? '#eff6ff' : '#f0fdf4',
                      color: exp.paymentMode === 'upi' ? MONEY_COLORS.brand : MONEY_COLORS.positive,
                      flexShrink: 0,
                    }}
                    icon={exp.paymentMode === 'upi' ? <MobileOutlined /> : <DollarCircleOutlined />}
                  />
                  <div style={{ minWidth: 0, textAlign: 'left' }}>
                    <Space size={5} align="center" wrap>
                      <Text strong style={{ fontSize: 13 }}>{exp.title}</Text>
                      {exp.hasReceipt && (
                        <Tooltip title="Receipt attached">
                          <FileImageOutlined style={{ fontSize: 11, color: '#06b6d4' }} aria-label="Receipt attached" />
                        </Tooltip>
                      )}
                    </Space>
                    <Text type="secondary" style={{ fontSize: 10.5, display: 'block' }}>
                      {exp.paidBy?.fullName} · {formatDate(exp.date)} · {formatTimeAgo(exp.date)}
                    </Text>
                    <Space size={4} wrap style={{ marginTop: 3 }}>
                      <Tag color={involvement.color} style={{ margin: 0, fontSize: 9.5, padding: '0 4px', borderRadius: 4 }}>
                        {involvement.label}
                      </Tag>
                      <Tag style={{ margin: 0, fontSize: 9.5, padding: '0 4px', borderRadius: 4 }}>
                        {exp.splitType === 'everyone' ? 'Split all' : 'Specific'}
                      </Tag>
                      <Tag
                        icon={<TeamOutlined style={{ fontSize: 9 }} aria-hidden="true" />}
                        style={{ margin: 0, fontSize: 9.5, padding: '0 4px', borderRadius: 4 }}
                      >
                        {exp.participantCount}
                      </Tag>
                      <Tag
                        color={exp.paymentMode === 'upi' ? 'blue' : 'green'}
                        style={{ margin: 0, fontSize: 9.5, padding: '0 4px', borderRadius: 4 }}
                      >
                        {exp.paymentMode === 'upi' ? 'UPI' : 'Cash'}
                      </Tag>
                    </Space>
                  </div>
                </Space>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="financial-num" style={{ fontSize: 14, color: MONEY_COLORS.neutral }}>
                    {formatMoney(exp.amount)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    your share{' '}
                    <span className="financial-num" style={{ color: '#7c3aed', fontWeight: 600 }}>
                      {formatMoney(exp.myShare)}
                    </span>
                  </Text>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </Card>
);
