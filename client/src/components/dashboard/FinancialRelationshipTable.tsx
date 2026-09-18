import React, { useState } from 'react';
import {
  Card, Table, Avatar, Typography, Space, Button, Empty, Tooltip, Tag, Skeleton, Grid, Pagination,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UserOutlined, SwapOutlined, InfoCircleOutlined, RightOutlined } from '@ant-design/icons';
import { RelationshipRow } from '../../types/reports';
import { formatMoney, formatSignedMoney, formatDate, netColor, MONEY_COLORS } from '../../utils/format';

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface FinancialRelationshipTableProps {
  rows: RelationshipRow[];
  isLoading: boolean;
  rangeLabel: string;
  onViewDetails: (row: RelationshipRow) => void;
}

const money = (value: number, color?: string) => (
  <span className="financial-num" style={{ fontSize: 12.5, color: color || MONEY_COLORS.neutral }}>
    {formatMoney(value)}
  </span>
);

const LEGEND = (
  <>
    <strong>Paid For</strong> columns are spending attribution for the selected period.{' '}
    <strong>Currently Owe</strong> columns are live all-time obligations after completed
    settlements. Debts stay directional — both sides can be non-zero at once.
  </>
);

/** One person as a stacked card. Used below `md`, where a 7-column table is unusable. */
const RelationshipCard: React.FC<{
  row: RelationshipRow;
  onViewDetails: (row: RelationshipRow) => void;
}> = ({ row, onViewDetails }) => {
  const cell = (label: string, value: number, color: string) => (
    <div style={{ minWidth: 0 }}>
      <Text type="secondary" style={{ fontSize: 9.5, fontWeight: 600, display: 'block', lineHeight: 1.3 }}>
        {label}
      </Text>
      <span
        className="financial-num"
        style={{ fontSize: 12.5, color: value > 0 ? color : MONEY_COLORS.muted }}
      >
        {formatMoney(value)}
      </span>
    </div>
  );

  return (
    <li className="dash-rel-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Space size={9} align="center" style={{ minWidth: 0 }}>
          <Avatar size={34} style={{ backgroundColor: '#0f172a', flexShrink: 0 }} icon={<UserOutlined />}>
            {row.person.fullName?.charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Text strong style={{ fontSize: 13, display: 'block', lineHeight: 1.25 }}>
              {row.person.fullName}
            </Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {row.relatedExpenseCount} {row.relatedExpenseCount === 1 ? 'expense' : 'expenses'}
              {row.lastRelatedExpenseDate ? ` · last ${formatDate(row.lastRelatedExpenseDate)}` : ''}
              {!row.isStillMember && ' · left group'}
            </Text>
          </div>
        </Space>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <Text type="secondary" style={{ fontSize: 9.5, fontWeight: 600, display: 'block' }}>NET</Text>
          <span
            className="financial-num"
            style={{ fontSize: 14, fontWeight: 700, color: netColor(row.netRelationship) }}
          >
            {formatSignedMoney(row.netRelationship)}
          </span>
        </div>
      </div>

      {/* Live obligations first — they are what the user can act on. */}
      <div className="dash-rel-card__grid" style={{ borderTop: '1px solid #e2e8f0' }}>
        {cell('I CURRENTLY OWE', row.iCurrentlyOwe, MONEY_COLORS.negative)}
        {cell('THEY CURRENTLY OWE', row.theyCurrentlyOwe, MONEY_COLORS.positive)}
      </div>

      {/* Historical attribution, visually secondary. */}
      <div className="dash-rel-card__grid dash-rel-card__grid--muted">
        {cell('I PAID FOR THEM', row.iPaidForThem, MONEY_COLORS.brand)}
        {cell('THEY PAID FOR ME', row.theyPaidForMe, '#7c3aed')}
      </div>

      <Button
        size="small"
        block
        onClick={() => onViewDetails(row)}
        style={{ borderRadius: 8, marginTop: 8, fontSize: 12 }}
        aria-label={`View financial details for ${row.person.fullName}`}
      >
        View Details <RightOutlined style={{ fontSize: 9 }} aria-hidden="true" />
      </Button>
    </li>
  );
};

/**
 * `My Financial Relationship`.
 *
 * Mixes two deliberately different kinds of number, so the headers and footnote spell out which
 * is which:
 *   - "I Paid For Them" / "They Paid For Me" → period-scoped spending attribution
 *   - "I Currently Owe" / "They Currently Owe" → all-time live obligations (balance engine)
 *
 * Renders as a table on desktop and as stacked cards below `md`, rather than forcing a ~1000px
 * horizontal scroll onto a phone.
 */
export const FinancialRelationshipTable: React.FC<FinancialRelationshipTableProps> = ({
  rows,
  isLoading,
  rangeLabel,
  onViewDetails,
}) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [page, setPage] = useState(1);
  const pageSize = 5;

  const maxPage = Math.max(1, Math.ceil(rows.length / pageSize));
  React.useEffect(() => {
    if (page > maxPage) setPage(maxPage);
  }, [page, maxPage]);

  const columns: ColumnsType<RelationshipRow> = [
    {
      title: 'Person',
      dataIndex: ['person', 'fullName'],
      key: 'person',
      fixed: 'left',
      width: 180,
      render: (_: unknown, row) => (
        <Space size={8} align="center">
          <Avatar size={28} style={{ backgroundColor: '#0f172a', flexShrink: 0 }} icon={<UserOutlined />}>
            {row.person.fullName?.charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Text strong style={{ fontSize: 12.5, display: 'block' }}>{row.person.fullName}</Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {row.relatedExpenseCount} {row.relatedExpenseCount === 1 ? 'expense' : 'expenses'}
              {!row.isStillMember && ' · left group'}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: (
        <Tooltip title={`Their share of bills you paid, ${rangeLabel}. Spending history, not a debt.`}>
          <span>I Paid For Them <InfoCircleOutlined style={{ fontSize: 10, color: '#94a3b8' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'iPaidForThem',
      key: 'iPaidForThem',
      align: 'right',
      width: 140,
      sorter: (a, b) => a.iPaidForThem - b.iPaidForThem,
      render: (v: number) => money(v, v > 0 ? MONEY_COLORS.brand : MONEY_COLORS.muted),
    },
    {
      title: (
        <Tooltip title={`Your share of bills they paid, ${rangeLabel}. Spending history, not a debt.`}>
          <span>They Paid For Me <InfoCircleOutlined style={{ fontSize: 10, color: '#94a3b8' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'theyPaidForMe',
      key: 'theyPaidForMe',
      align: 'right',
      width: 150,
      sorter: (a, b) => a.theyPaidForMe - b.theyPaidForMe,
      render: (v: number) => money(v, v > 0 ? '#7c3aed' : MONEY_COLORS.muted),
    },
    {
      title: (
        <Tooltip title="Live outstanding amount you owe this person, all time, after completed settlements.">
          <span>I Currently Owe <InfoCircleOutlined style={{ fontSize: 10, color: '#94a3b8' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'iCurrentlyOwe',
      key: 'iCurrentlyOwe',
      align: 'right',
      width: 140,
      sorter: (a, b) => a.iCurrentlyOwe - b.iCurrentlyOwe,
      render: (v: number) => money(v, v > 0 ? MONEY_COLORS.negative : MONEY_COLORS.muted),
    },
    {
      title: (
        <Tooltip title="Live outstanding amount this person owes you, all time, after completed settlements.">
          <span>They Currently Owe <InfoCircleOutlined style={{ fontSize: 10, color: '#94a3b8' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'theyCurrentlyOwe',
      key: 'theyCurrentlyOwe',
      align: 'right',
      width: 160,
      sorter: (a, b) => a.theyCurrentlyOwe - b.theyCurrentlyOwe,
      render: (v: number) => money(v, v > 0 ? MONEY_COLORS.positive : MONEY_COLORS.muted),
    },
    {
      title: (
        <Tooltip title="Display-only summary of the two live obligations. Each direction must still be settled separately.">
          <span>Net Relationship <InfoCircleOutlined style={{ fontSize: 10, color: '#94a3b8' }} /></span>
        </Tooltip>
      ),
      dataIndex: 'netRelationship',
      key: 'netRelationship',
      align: 'right',
      width: 150,
      sorter: (a, b) => a.netRelationship - b.netRelationship,
      render: (v: number) => (
        <span className="financial-num" style={{ fontSize: 12.5, fontWeight: 700, color: netColor(v) }}>
          {formatSignedMoney(v)}
        </span>
      ),
    },
    {
      title: 'Last Expense',
      dataIndex: 'lastRelatedExpenseDate',
      key: 'last',
      width: 120,
      render: (v: string | null) => (
        <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(v)}</Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      fixed: 'right',
      width: 110,
      render: (_: unknown, row) => (
        <Button
          size="small"
          type="link"
          onClick={() => onViewDetails(row)}
          style={{ padding: 0, fontSize: 12 }}
          aria-label={`View financial details for ${row.person.fullName}`}
        >
          View Details
        </Button>
      ),
    },
  ];

  const body = () => {
    if (isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;

    if (rows.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No financial activity with anyone in this period."
          style={{ margin: '20px 0' }}
        />
      );
    }

    if (isMobile) {
      const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
      return (
        <>
          <ul className="dash-rel-list">
            {pageRows.map((row) => (
              <RelationshipCard key={row.person._id} row={row} onViewDetails={onViewDetails} />
            ))}
          </ul>
          {rows.length > pageSize && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              <Pagination
                simple
                current={page}
                pageSize={pageSize}
                total={rows.length}
                onChange={setPage}
                size="small"
              />
            </div>
          )}
          <Text type="secondary" style={{ fontSize: 10.5, display: 'block', marginTop: 10, lineHeight: 1.5 }}>
            {LEGEND}
          </Text>
        </>
      );
    }

    return (
      <>
        <Table<RelationshipRow>
          rowKey={(r) => r.person._id}
          columns={columns}
          dataSource={rows}
          size="small"
          scroll={{ x: 1050 }}
          pagination={
            rows.length > 10
              ? { pageSize: 10, size: 'small', showSizeChanger: false, showTotal: (t) => `${t} people` }
              : false
          }
        />
        <Text type="secondary" style={{ fontSize: 10.5, display: 'block', marginTop: 8, lineHeight: 1.5 }}>
          {LEGEND}
        </Text>
      </>
    );
  };

  return (
    <Card
      title={
        <Space size={6}>
          <SwapOutlined style={{ color: MONEY_COLORS.brand }} aria-hidden="true" />
          <span style={{ fontSize: 14 }}>My Financial Relationship</span>
        </Space>
      }
      extra={
        <Tag style={{ margin: 0, fontSize: 10, borderRadius: 4, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {rangeLabel}
        </Tag>
      }
      style={{ borderRadius: 14 }}
      styles={{ body: { padding: 12 } }}
    >
      {body()}
    </Card>
  );
};
