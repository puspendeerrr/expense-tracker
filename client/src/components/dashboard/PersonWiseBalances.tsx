import React, { useState, useMemo, useEffect } from 'react';
import {
  Card, Segmented, Avatar, Typography, Space, Button, Tag, Empty, Pagination, Badge, Tooltip, Skeleton, Grid,
} from 'antd';
import {
  UserOutlined, QrcodeOutlined, SendOutlined, TeamOutlined,
  ArrowDownOutlined, ArrowUpOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { PersonDueRow } from '../../types/reports';
import { formatMoney, formatDate, MONEY_COLORS } from '../../utils/format';

const { Text } = Typography;
const { useBreakpoint } = Grid;

type TabKey = 'i_owe' | 'owes_me';

interface PersonWiseBalancesProps {
  peopleIOwe: PersonDueRow[];
  peopleWhoOweMe: PersonDueRow[];
  isLoading: boolean;
  isCreator: boolean;
  remindLoadingMap: Record<string, boolean>;
  onSettle: (row: PersonDueRow) => void;
  onShowUpi: (row: PersonDueRow) => void;
  onRemind: (userId: string, name: string) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const SETTLEMENT_STATUS_META: Record<string, { label: string; color: string }> = {
  paid_pending_approval: { label: 'Awaiting verification', color: 'gold' },
  will_pay_soon: { label: 'Promised to pay', color: 'processing' },
  rejected: { label: 'Payment rejected', color: 'error' },
};

const PersonRow: React.FC<{
  row: PersonDueRow;
  mode: TabKey;
  isCreator: boolean;
  remindLoading: boolean;
  onSettle: (row: PersonDueRow) => void;
  onShowUpi: (row: PersonDueRow) => void;
  onRemind: (userId: string, name: string) => void;
}> = ({ row, mode, isCreator, remindLoading, onSettle, onShowUpi, onRemind }) => {
  const statusMeta = row.pendingSettlement
    ? SETTLEMENT_STATUS_META[row.pendingSettlement.status]
    : null;

  const amountColor = mode === 'i_owe' ? MONEY_COLORS.negative : MONEY_COLORS.positive;

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '10px 12px',
        background: '#f8fafc',
        borderRadius: 10,
        border: '1px solid #e2e8f0',
        flexWrap: 'wrap',
      }}
    >
      <Space size={10} align="center" style={{ minWidth: 0, flex: '1 1 190px' }}>
        <Avatar
          size={38}
          style={{ backgroundColor: mode === 'i_owe' ? '#0f172a' : MONEY_COLORS.brand, flexShrink: 0 }}
          icon={<UserOutlined />}
        >
          {row.user.fullName?.charAt(0).toUpperCase()}
        </Avatar>

        <div style={{ minWidth: 0 }}>
          <Text strong style={{ fontSize: 13, display: 'block', lineHeight: 1.25 }}>
            {row.user.fullName}
          </Text>
          <div className="financial-num" style={{ fontSize: 14, color: amountColor, fontWeight: 700 }}>
            {formatMoney(row.amount)}
          </div>
          <Text type="secondary" style={{ fontSize: 10.5 }}>
            {row.relatedExpenseCount} {row.relatedExpenseCount === 1 ? 'expense' : 'expenses'}
            {row.lastRelatedExpenseDate ? ` · last ${formatDate(row.lastRelatedExpenseDate)}` : ''}
          </Text>
          {statusMeta && (
            <div style={{ marginTop: 3 }}>
              <Tag
                icon={<ClockCircleOutlined aria-hidden="true" />}
                color={statusMeta.color}
                style={{ margin: 0, fontSize: 10, borderRadius: 4 }}
              >
                {statusMeta.label} · {formatMoney(row.pendingSettlement!.amount)}
              </Tag>
            </div>
          )}
        </div>
      </Space>

      <Space size={6} wrap>
        <Tooltip title={`Show ${row.user.fullName}'s UPI ID and QR code`}>
          <Button
            size="small"
            icon={<QrcodeOutlined />}
            onClick={() => onShowUpi(row)}
            style={{ borderRadius: 8 }}
            aria-label={`Show UPI details for ${row.user.fullName}`}
          >
            UPI / QR
          </Button>
        </Tooltip>

        {mode === 'i_owe' ? (
          <Button
            size="small"
            type="primary"
            onClick={() => onSettle(row)}
            style={{ borderRadius: 8, background: MONEY_COLORS.brand }}
            aria-label={`Settle ${formatMoney(row.amount)} with ${row.user.fullName}`}
          >
            Settle
          </Button>
        ) : isCreator ? (
          <Tooltip title="Send a payment reminder">
            <Button
              size="small"
              icon={<SendOutlined />}
              loading={remindLoading}
              onClick={() => onRemind(row.user._id, row.user.fullName)}
              style={{ borderRadius: 8 }}
              aria-label={`Send a payment reminder to ${row.user.fullName}`}
            >
              Remind
            </Button>
          </Tooltip>
        ) : null}
      </Space>
    </li>
  );
};

/**
 * Person-wise current dues.
 *
 * Both lists come from the server's balance engine in full (the API does not truncate them), so
 * paginating here is paging over the complete result set, not over an already-clipped list.
 */
export const PersonWiseBalances: React.FC<PersonWiseBalancesProps> = ({
  peopleIOwe,
  peopleWhoOweMe,
  isLoading,
  isCreator,
  remindLoadingMap,
  onSettle,
  onShowUpi,
  onRemind,
}) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [tab, setTab] = useState<TabKey>('i_owe');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const activeList = tab === 'i_owe' ? peopleIOwe : peopleWhoOweMe;
  const total = activeList.length;

  // Keep the page valid when the underlying list shrinks (e.g. a debt is settled live).
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > maxPage) setPage(maxPage);
  }, [page, maxPage]);

  // Switching tabs restarts paging; changing an unrelated filter preserves it.
  const handleTabChange = (value: TabKey) => {
    setTab(value);
    setPage(1);
  };

  const pageRows = useMemo(
    () => activeList.slice((page - 1) * pageSize, page * pageSize),
    [activeList, page, pageSize]
  );

  const emptyMessage =
    tab === 'i_owe' ? 'You currently owe no one.' : 'No one currently owes you.';

  return (
    <Card
      title={
        <Space size={6}>
          <TeamOutlined style={{ color: MONEY_COLORS.brand }} aria-hidden="true" />
          <span style={{ fontSize: 14 }}>Person-wise Balances</span>
        </Space>
      }
      extra={
        <Tooltip title="Live outstanding dues from the balance engine. Not affected by the date filter.">
          <Tag style={{ margin: 0, fontSize: 10, borderRadius: 4 }}>All time</Tag>
        </Tooltip>
      }
      style={{ borderRadius: 14 }}
      styles={{ body: { padding: 12 } }}
    >
      <Segmented
        block
        value={tab}
        onChange={(v) => handleTabChange(v as TabKey)}
        style={{ marginBottom: 12 }}
        aria-label="Switch between people you owe and people who owe you"
        options={[
          {
            value: 'i_owe',
            label: (
              <Space size={5}>
                <ArrowDownOutlined style={{ fontSize: 11 }} aria-hidden="true" />
                <span>{isMobile ? 'I Owe' : 'People I Owe'}</span>
                {peopleIOwe.length > 0 && (
                  <Badge count={peopleIOwe.length} style={{ backgroundColor: MONEY_COLORS.negative }} />
                )}
              </Space>
            ),
          },
          {
            value: 'owes_me',
            label: (
              <Space size={5}>
                <ArrowUpOutlined style={{ fontSize: 11 }} aria-hidden="true" />
                <span>{isMobile ? 'Owes Me' : 'People Who Owe Me'}</span>
                {peopleWhoOweMe.length > 0 && (
                  <Badge count={peopleWhoOweMe.length} style={{ backgroundColor: MONEY_COLORS.positive }} />
                )}
              </Space>
            ),
          },
        ]}
      />

      {isLoading ? (
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} active avatar paragraph={{ rows: 1 }} title={{ width: '35%' }} />
          ))}
        </Space>
      ) : total === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyMessage} style={{ margin: '20px 0' }} />
      ) : (
        <>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pageRows.map((row) => (
              <PersonRow
                key={row.user._id}
                row={row}
                mode={tab}
                isCreator={isCreator}
                remindLoading={!!remindLoadingMap[row.user._id]}
                onSettle={onSettle}
                onShowUpi={onShowUpi}
                onRemind={onRemind}
              />
            ))}
          </ul>

          {total > PAGE_SIZE_OPTIONS[0] && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                onChange={(p, ps) => {
                  setPage(p);
                  if (ps !== pageSize) setPageSize(ps);
                }}
                showSizeChanger={total > 10}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                size="small"
                showTotal={(t, range) => `${range[0]}–${range[1]} of ${t}`}
              />
            </div>
          )}
        </>
      )}
    </Card>
  );
};
