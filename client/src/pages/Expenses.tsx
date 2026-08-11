import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Input,
  Select,
  Segmented,
  Button,
  Tag,
  Typography,
  Space,
  Empty,
  Spin,
  Pagination,
  Flex,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  DollarOutlined,
  CalendarOutlined,
  DollarCircleOutlined,
  MobileOutlined,
  ReloadOutlined,
  FileTextOutlined,
  TeamOutlined,
  UserOutlined,
  WalletOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { Expense, GroupMember } from '../types';
import api from '../services/api';

import { AddExpenseModal } from '../components/modals/AddExpenseModal';
import { ExpenseDetailModal } from '../components/modals/ExpenseDetailModal';
import { EditExpenseModal } from '../components/modals/EditExpenseModal';

const { Title, Text } = Typography;

export const Expenses: React.FC = () => {
  const { user } = useAuth();
  const { showError } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<string>('all');
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/expenses');
      setExpenses(res.data || []);

      const groupRes = await api.get('/groups/info');
      setMembers(groupRes.data.members || []);
    } catch (err: any) {
      console.error('Fetch Expenses Error:', err);
      showError('Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
  };

  const processedExpenses = useMemo(() => {
    let list = expenses.filter((exp) => {
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !query ||
        exp.title.toLowerCase().includes(query) ||
        exp.paidBy?.fullName?.toLowerCase().includes(query) ||
        (exp.notes && exp.notes.toLowerCase().includes(query));
      const matchesFilter = filterMode === 'all' || exp.paymentMode === filterMode;

      // Member / Person involvement filter
      let matchesMember = true;
      if (memberFilter !== 'all') {
        const targetId = memberFilter === 'me' ? user?._id : memberFilter;

        if (targetId) {
          const paidById = typeof exp.paidBy === 'object' ? exp.paidBy?._id : exp.paidBy;
          const isPayer = paidById?.toString() === targetId.toString();

          let isParticipant = false;
          if (exp.splitType === 'everyone') {
            isParticipant = true;
          } else if (exp.splitDetails && Array.isArray(exp.splitDetails)) {
            isParticipant = exp.splitDetails.some((s) => {
              const sId = typeof s.user === 'object' ? s.user?._id : s.user;
              return sId?.toString() === targetId.toString();
            });
          }

          matchesMember = isPayer || isParticipant;
        }
      }

      return matchesSearch && matchesFilter && matchesMember;
    });

    list.sort((a, b) => {
      const timeA = new Date(a.date || a.createdAt || 0).getTime();
      const timeB = new Date(b.date || b.createdAt || 0).getTime();
      if (sortBy === 'newest') return timeB - timeA;
      if (sortBy === 'oldest') return timeA - timeB;
      if (sortBy === 'highest') return b.amount - a.amount;
      if (sortBy === 'lowest') return a.amount - b.amount;
      return 0;
    });

    return list;
  }, [expenses, searchTerm, filterMode, memberFilter, sortBy, user]);

  const totalExpenseSum = useMemo(() => {
    return processedExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  }, [processedExpenses]);

  const cashCount = useMemo(() => {
    return processedExpenses.filter(e => e.paymentMode === 'cash').length;
  }, [processedExpenses]);

  const upiCount = useMemo(() => {
    return processedExpenses.filter(e => e.paymentMode === 'upi').length;
  }, [processedExpenses]);

  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedExpenses.slice(start, start + pageSize);
  }, [processedExpenses, currentPage]);

  const memberOptions = useMemo(() => {
    const opts = [
      { label: 'All Members', value: 'all' },
      { label: 'Involving Me (Paid or Owed)', value: 'me' },
    ];
    members.forEach((m) => {
      if (m._id !== user?._id) {
        opts.push({
          label: m.fullName,
          value: m._id,
        });
      }
    });
    return opts;
  }, [members, user]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Top Controls Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Expenses ({expenses.length})
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Total Tracked: <strong className="financial-num" style={{ color: '#2563eb' }}>₹{totalExpenseSum.toFixed(2)}</strong>
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsAddExpenseOpen(true)}
          style={{ borderRadius: 10, background: '#2563eb', height: 38 }}
        >
          Add Expense
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card style={{ borderRadius: 14 }} styles={{ body: { padding: 12 } }}>
        <Flex vertical gap={10}>
          <Input
            placeholder="Search bills, flatmates or notes..."
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            allowClear
            size="middle"
            style={{ borderRadius: 10 }}
          />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Segmented
              value={filterMode}
              onChange={(val) => {
                setFilterMode(val as string);
                setCurrentPage(1);
              }}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Cash', value: 'cash' },
                { label: 'UPI', value: 'upi' },
              ]}
              style={{ minWidth: 150 }}
              size="middle"
            />

            <Select
              value={memberFilter}
              onChange={(val) => {
                setMemberFilter(val);
                setCurrentPage(1);
              }}
              style={{ flex: 1, minWidth: 170 }}
              size="middle"
              options={memberOptions}
              placeholder="Filter by Person"
            />

            <Select
              value={sortBy}
              onChange={(val) => setSortBy(val)}
              style={{ width: 120 }}
              size="middle"
              options={[
                { label: 'Newest', value: 'newest' },
                { label: 'Oldest', value: 'oldest' },
                { label: 'Highest', value: 'highest' },
                { label: 'Lowest', value: 'lowest' },
              ]}
            />
          </div>
        </Flex>
      </Card>

      {/* Expense Items List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Spin size="large" />
          <Text type="secondary" style={{ fontSize: 13 }}>Loading expenses...</Text>
        </div>
      ) : processedExpenses.length > 0 ? (
        <Card style={{ borderRadius: 14 }} styles={{ body: { padding: 0 } }}>
          <Flex vertical>
            {paginatedExpenses.map((exp, idx) => (
              <div
                key={exp._id || idx}
                style={{
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: idx !== paginatedExpenses.length - 1 ? '1px solid #f1f5f9' : 'none',
                  background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                  transition: 'background 0.15s ease',
                }}
                onClick={() => setSelectedExpense(exp)}
              >
                <div style={{ minWidth: 0, paddingRight: 8 }}>
                  <Text strong style={{ fontSize: 14, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {exp.title}
                  </Text>
                  <Space size={6} style={{ fontSize: 11, marginTop: 2 }} wrap>
                    <Text type="secondary">Paid by {exp.paidBy?.fullName?.split(' ')[0]}</Text>
                    <Text type="secondary">•</Text>
                    <Text type="secondary">{formatDate(exp.date || exp.createdAt || '')}</Text>
                    <Tag
                      color={exp.paymentMode === 'upi' ? 'blue' : 'green'}
                      icon={exp.paymentMode === 'upi' ? <MobileOutlined /> : <DollarCircleOutlined />}
                      style={{ margin: 0, fontSize: 10, padding: '0 6px', lineHeight: '18px', borderRadius: 6 }}
                    >
                      {exp.paymentMode === 'upi' ? 'UPI' : 'Cash'}
                    </Tag>
                    {exp.screenshotUrl && (
                      <Tag color="cyan" style={{ margin: 0, fontSize: 10, padding: '0 6px', lineHeight: '18px', borderRadius: 6 }}>
                        Receipt
                      </Tag>
                    )}
                  </Space>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="financial-num" style={{ fontSize: 15, color: '#2563eb', fontWeight: 600 }}>
                    ₹{exp.amount.toFixed(2)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    {exp.splitType === 'everyone' ? 'Split All' : `${exp.splitDetails?.length || 1} shares`}
                  </Text>
                </div>
              </div>
            ))}
          </Flex>

          {processedExpenses.length > pageSize && (
            <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'center', borderTop: '1px solid #e2e8f0' }}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={processedExpenses.length}
                onChange={(p) => setCurrentPage(p)}
                showSizeChanger={false}
                size="small"
              />
            </div>
          )}
        </Card>
      ) : (
        <Card style={{ borderRadius: 14, textAlign: 'center', padding: '36px 16px' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No matching expenses found."
          >
            <Button type="primary" onClick={() => setIsAddExpenseOpen(true)} style={{ borderRadius: 10, background: '#2563eb' }}>
              Add First Expense
            </Button>
          </Empty>
        </Card>
      )}

      {/* Modals */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        members={members}
        onExpenseAdded={fetchExpenses}
      />

      <ExpenseDetailModal
        isOpen={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        expense={selectedExpense}
        onEdit={(exp) => setEditingExpense(exp)}
        onExpenseDeleted={fetchExpenses}
      />

      <EditExpenseModal
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        expense={editingExpense}
        members={members}
        onExpenseUpdated={fetchExpenses}
      />
    </div>
  );
};

export default Expenses;
