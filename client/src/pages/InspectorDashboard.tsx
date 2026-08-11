import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Typography,
  Tag,
  Space,
  Select,
  Table,
  Tabs,
  Badge,
  Spin,
  Button,
  Alert,
  Divider,
  Input,
  Row,
  Col,
  Statistic,
  Progress,
  Segmented,
} from 'antd';
import {
  SafetyCertificateOutlined,
  TeamOutlined,
  DollarOutlined,
  HistoryOutlined,
  SearchOutlined,
  UserOutlined,
  FileTextOutlined,
  FolderOutlined,
  PieChartOutlined,
  TrophyOutlined,
  WalletOutlined,
  BankOutlined,
  ReloadOutlined,
  ClearOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import { useToast } from '../components/ui/Toast';

const { Title, Text } = Typography;

export interface InspectorGroup {
  _id: string;
  name: string;
  inviteCode: string;
  createdBy?: { fullName: string; email: string };
  createdAt: string;
  memberCount: number;
  members: any[];
  expenseCount: number;
  totalExpenseSum: number;
  settlementCount: number;
  completedSettlementSum: number;
}

export const InspectorDashboard: React.FC = () => {
  const { showError } = useToast();
  const [activeTab, setActiveTab] = useState<string>('groups');
  const [groups, setGroups] = useState<InspectorGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupDetails, setGroupDetails] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoadingGroups, setIsLoadingGroups] = useState<boolean>(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState<boolean>(false);

  // Group search state
  const [groupSearchQuery, setGroupSearchQuery] = useState<string>('');

  // Person-wise breakdown filter states
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');
  const [balanceFilter, setBalanceFilter] = useState<string>('all'); // all, owe, receive, settled

  // Expense history filter states
  const [expenseSearchQuery, setExpenseSearchQuery] = useState<string>('');
  const [expensePaymentMode, setExpensePaymentMode] = useState<string>('all'); // all, cash, upi
  const [expenseSortBy, setExpenseSortBy] = useState<string>('newest'); // newest, oldest, amount-high, amount-low

  // Settlement history filter states
  const [settlementSearchQuery, setSettlementSearchQuery] = useState<string>('');
  const [settlementStatusFilter, setSettlementStatusFilter] = useState<string>('all'); // all, completed, pending, rejected

  // Fetch all listed groups
  const fetchAllGroups = async () => {
    try {
      setIsLoadingGroups(true);
      const res = await api.get('/inspector/groups');
      const grps = res.data.groups || [];
      setGroups(grps);
      if (grps.length > 0 && !selectedGroupId) {
        setSelectedGroupId(grps[0]._id);
      }
    } catch (err: any) {
      console.error('[Inspector Fetch Groups Error]:', err);
      showError('Failed to load groups for inspection.');
    } finally {
      setIsLoadingGroups(false);
    }
  };

  // Fetch selected group details
  const fetchGroupDetails = async (gId: string) => {
    try {
      setIsLoadingDetails(true);
      const res = await api.get(`/inspector/groups/${gId}`);
      setGroupDetails(res.data);
    } catch (err: any) {
      console.error('[Inspector Fetch Group Details Error]:', err);
      showError('Failed to load group inspection details.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Fetch global platform analytics (Aggregation Pipeline)
  const fetchAnalytics = async () => {
    try {
      setIsLoadingAnalytics(true);
      const res = await api.get('/inspector/analytics');
      setAnalytics(res.data);
    } catch (err: any) {
      console.error('[Inspector Fetch Analytics Error]:', err);
      showError('Failed to load platform analytics.');
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchAllGroups();
    fetchAnalytics();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupDetails(selectedGroupId);
    }
  }, [selectedGroupId]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  };

  // Filtered groups based on search query
  const filteredGroups = useMemo(() => {
    if (!groupSearchQuery.trim()) return groups;
    const q = groupSearchQuery.toLowerCase().trim();
    return groups.filter(
      (g) => g.name.toLowerCase().includes(q) || g.inviteCode.toLowerCase().includes(q)
    );
  }, [groups, groupSearchQuery]);

  // Filtered person-wise breakdown
  const filteredPersonBreakdown = useMemo(() => {
    if (!groupDetails?.personWiseBreakdown) return [];
    let list = groupDetails.personWiseBreakdown;

    if (memberSearchQuery.trim()) {
      const q = memberSearchQuery.toLowerCase().trim();
      list = list.filter(
        (pw: any) =>
          pw.member.fullName?.toLowerCase().includes(q) ||
          pw.member.email?.toLowerCase().includes(q) ||
          pw.member.phone?.includes(q)
      );
    }

    if (balanceFilter === 'owe') {
      list = list.filter((pw: any) => pw.netBalance < -0.01);
    } else if (balanceFilter === 'receive') {
      list = list.filter((pw: any) => pw.netBalance > 0.01);
    } else if (balanceFilter === 'settled') {
      list = list.filter((pw: any) => Math.abs(pw.netBalance) <= 0.01);
    }

    return list;
  }, [groupDetails, memberSearchQuery, balanceFilter]);

  // Filtered expense history
  const filteredExpenses = useMemo(() => {
    if (!groupDetails?.expenses) return [];
    let list = [...groupDetails.expenses];

    if (expenseSearchQuery.trim()) {
      const q = expenseSearchQuery.toLowerCase().trim();
      list = list.filter(
        (exp: any) =>
          exp.title?.toLowerCase().includes(q) ||
          exp.paidBy?.fullName?.toLowerCase().includes(q)
      );
    }

    if (expensePaymentMode !== 'all') {
      list = list.filter((exp: any) => exp.paymentMode?.toLowerCase() === expensePaymentMode);
    }

    list.sort((a: any, b: any) => {
      if (expenseSortBy === 'oldest') {
        return new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime();
      }
      if (expenseSortBy === 'amount-high') {
        return b.amount - a.amount;
      }
      if (expenseSortBy === 'amount-low') {
        return a.amount - b.amount;
      }
      return new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime();
    });

    return list;
  }, [groupDetails, expenseSearchQuery, expensePaymentMode, expenseSortBy]);

  // Filtered settlement history
  const filteredSettlements = useMemo(() => {
    if (!groupDetails?.settlements) return [];
    let list = [...groupDetails.settlements];

    if (settlementSearchQuery.trim()) {
      const q = settlementSearchQuery.toLowerCase().trim();
      list = list.filter(
        (s: any) =>
          s.payer?.fullName?.toLowerCase().includes(q) ||
          s.receiver?.fullName?.toLowerCase().includes(q)
      );
    }

    if (settlementStatusFilter !== 'all') {
      list = list.filter((s: any) => s.status?.toLowerCase() === settlementStatusFilter);
    }

    return list;
  }, [groupDetails, settlementSearchQuery, settlementStatusFilter]);

  const clearAllGroupFilters = () => {
    setMemberSearchQuery('');
    setBalanceFilter('all');
    setExpenseSearchQuery('');
    setExpensePaymentMode('all');
    setExpenseSortBy('newest');
    setSettlementSearchQuery('');
    setSettlementStatusFilter('all');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header Audit Banner */}
      <Alert
        message={
          <Space align="center" size={8}>
            <SafetyCertificateOutlined style={{ fontSize: 20, color: '#722ed1' }} />
            <Text strong style={{ fontSize: 15, color: '#581c87' }}>
              Inspector Audit Console (Read-Only Mode)
            </Text>
          </Space>
        }
        description="Logged in as inspect@gmail.com. You have global read-only access to inspect listed groups, aggregate system analytics, person-wise expense shares, and settlement audit logs."
        type="info"
        showIcon={false}
        style={{
          borderRadius: 14,
          background: 'linear-gradient(135deg, #f9f5ff 0%, #f3e8ff 100%)',
          border: '1px solid #d8b4fe',
          boxShadow: '0 2px 8px rgba(114, 46, 209, 0.06)',
        }}
      />

      {/* Global Analytics Overview Cards */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 14, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 14 } }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}><DollarOutlined /> Total Platform Spend</Text>}
              value={analytics?.summary?.totalExpenseVolume || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#2563eb', fontWeight: 700, fontSize: 20 }}
            />
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
              {analytics?.summary?.totalExpenseCount || 0} expenses across {analytics?.summary?.totalGroups || groups.length} groups
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 14, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 14 } }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}><FolderOutlined /> Active Groups Listed</Text>}
              value={analytics?.summary?.totalGroups || groups.length}
              valueStyle={{ color: '#0d9488', fontWeight: 700, fontSize: 20 }}
            />
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
              {analytics?.summary?.totalUsers || 0} platform users registered
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 14, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 14 } }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}><HistoryOutlined /> Settlement Volume</Text>}
              value={analytics?.settlementStats?.completedVolume || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#16a34a', fontWeight: 700, fontSize: 20 }}
            />
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
              {analytics?.settlementStats?.completedCount || 0} completed settlements
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 14, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 14 } }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}><BarChartOutlined /> Avg Expense Size</Text>}
              value={analytics?.summary?.avgExpenseAmount || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#7c3aed', fontWeight: 700, fontSize: 20 }}
            />
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
              Calculated via MongoDB Aggregation
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Main Navigation Segmented Control */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Segmented
          value={activeTab}
          onChange={(val) => setActiveTab(val as string)}
          size="large"
          options={[
            {
              label: (
                <Space size={6}>
                  <FolderOutlined />
                  <span>Group Audit</span>
                </Space>
              ),
              value: 'groups',
            },
            {
              label: (
                <Space size={6}>
                  <PieChartOutlined />
                  <span>Platform Analytics & Spenders</span>
                </Space>
              ),
              value: 'analytics',
            },
          ]}
        />

        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            fetchAllGroups();
            fetchAnalytics();
            if (selectedGroupId) fetchGroupDetails(selectedGroupId);
          }}
          loading={isLoadingGroups || isLoadingAnalytics}
        >
          Refresh Data
        </Button>
      </div>

      {activeTab === 'analytics' ? (
        /* Platform Analytics View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Row gutter={[16, 16]}>
            {/* Payment Mode Distribution */}
            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <WalletOutlined style={{ color: '#2563eb' }} />
                    <span>Payment Mode Distribution (Aggregation)</span>
                  </Space>
                }
                style={{ borderRadius: 14, height: '100%' }}
              >
                {analytics?.summary ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text strong><BankOutlined /> UPI / Online Payments</Text>
                        <Text strong style={{ color: '#2563eb' }}>₹{analytics.summary.upiVolume.toFixed(2)} ({analytics.summary.upiCount} entries)</Text>
                      </div>
                      <Progress
                        percent={
                          analytics.summary.totalExpenseVolume > 0
                            ? Math.round((analytics.summary.upiVolume / analytics.summary.totalExpenseVolume) * 100)
                            : 0
                        }
                        strokeColor="#2563eb"
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text strong><DollarOutlined /> Cash Payments</Text>
                        <Text strong style={{ color: '#16a34a' }}>₹{analytics.summary.cashVolume.toFixed(2)} ({analytics.summary.cashCount} entries)</Text>
                      </div>
                      <Progress
                        percent={
                          analytics.summary.totalExpenseVolume > 0
                            ? Math.round((analytics.summary.cashVolume / analytics.summary.totalExpenseVolume) * 100)
                            : 0
                        }
                        strokeColor="#16a34a"
                      />
                    </div>
                  </div>
                ) : (
                  <Spin />
                )}
              </Card>
            </Col>

            {/* Top Spenders Leaderboard */}
            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <TrophyOutlined style={{ color: '#d97706' }} />
                    <span>Top Spenders Leaderboard</span>
                  </Space>
                }
                style={{ borderRadius: 14, height: '100%' }}
              >
                {analytics?.topSpenders && analytics.topSpenders.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {analytics.topSpenders.map((sp: any, idx: number) => (
                      <div
                        key={sp._id || idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: idx === 0 ? '#fef3c7' : '#f8fafc',
                          border: idx === 0 ? '1px solid #fde68a' : '1px solid #f1f5f9',
                          borderRadius: 10,
                        }}
                      >
                        <Space size={10}>
                          <Badge
                            count={`#${idx + 1}`}
                            style={{
                              backgroundColor: idx === 0 ? '#d97706' : idx === 1 ? '#4b5563' : '#9ca3af',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          />
                          <div>
                            <Text strong style={{ fontSize: 13, display: 'block' }}>
                              {sp.fullName || 'User'}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {sp.email} · {sp.expenseCount} payments
                            </Text>
                          </div>
                        </Space>

                        <Text strong style={{ fontSize: 15, color: '#2563eb' }}>
                          ₹{sp.totalPaid.toFixed(2)}
                        </Text>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text type="secondary">No spending records available.</Text>
                )}
              </Card>
            </Col>
          </Row>

          {/* Group Comparison Table */}
          <Card
            title={
              <Space>
                <FolderOutlined style={{ color: '#7c3aed' }} />
                <span>All Groups Audit Comparison</span>
              </Space>
            }
            style={{ borderRadius: 14 }}
            styles={{ body: { padding: 0 } }}
          >
            <Table
              dataSource={groups}
              rowKey="_id"
              pagination={{ pageSize: 5 }}
              scroll={{ x: 600 }}
              columns={[
                {
                  title: 'Group Name',
                  dataIndex: 'name',
                  key: 'name',
                  render: (text, record) => (
                    <div>
                      <Text strong style={{ fontSize: 14 }}>{text}</Text>
                      <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>Code: {record.inviteCode}</Text>
                    </div>
                  ),
                },
                {
                  title: 'Members',
                  dataIndex: 'memberCount',
                  key: 'memberCount',
                  render: (count) => <Tag color="blue"><TeamOutlined /> {count} members</Tag>,
                },
                {
                  title: 'Total Expenses',
                  dataIndex: 'totalExpenseSum',
                  key: 'totalExpenseSum',
                  render: (sum, record) => (
                    <div>
                      <Text strong style={{ color: '#2563eb' }}>₹{sum.toFixed(2)}</Text>
                      <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{record.expenseCount} entries</Text>
                    </div>
                  ),
                },
                {
                  title: 'Settlements Volume',
                  dataIndex: 'completedSettlementSum',
                  key: 'completedSettlementSum',
                  render: (sum, record) => (
                    <div>
                      <Text strong style={{ color: '#16a34a' }}>₹{sum.toFixed(2)}</Text>
                      <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{record.settlementCount} records</Text>
                    </div>
                  ),
                },
                {
                  title: 'Action',
                  key: 'action',
                  render: (_, record) => (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setSelectedGroupId(record._id);
                        setActiveTab('groups');
                      }}
                    >
                      Inspect Group
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      ) : (
        /* Group Inspection View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Group Selector & Search Header */}
          <Card style={{ borderRadius: 14 }} styles={{ body: { padding: 14 } }}>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} sm={10} md={8}>
                <Input
                  placeholder="Search group by name or code..."
                  prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  allowClear
                />
              </Col>

              <Col xs={24} sm={14} md={12}>
                <Select
                  value={selectedGroupId}
                  onChange={(val) => setSelectedGroupId(val)}
                  loading={isLoadingGroups}
                  style={{ width: '100%' }}
                  options={filteredGroups.map((g) => ({
                    label: `${g.name} (${g.memberCount} members · ₹${g.totalExpenseSum.toFixed(2)})`,
                    value: g._id,
                  }))}
                  placeholder="Select group to inspect"
                />
              </Col>

              <Col xs={24} md={4} style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Showing {filteredGroups.length} of {groups.length} groups
                </Text>
              </Col>
            </Row>
          </Card>

          {/* Group Audit Detail Body */}
          {isLoadingDetails ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Spin size="large" />
              <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 13 }}>
                Loading group inspection audit data...
              </Text>
            </div>
          ) : groupDetails ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Group Overview Quick Metrics */}
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={8}>
                  <Card style={{ borderRadius: 12, background: '#f0f7ff', border: '1px solid #bae6fd' }} styles={{ body: { padding: 12 } }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>Active Group</Text>
                    <Title level={4} style={{ margin: '2px 0 0', fontSize: 16 }}>{groupDetails.group?.name}</Title>
                    <Text type="secondary" style={{ fontSize: 11 }}>Invite Code: {groupDetails.group?.inviteCode}</Text>
                  </Card>
                </Col>

                <Col xs={24} sm={8}>
                  <Card style={{ borderRadius: 12, background: '#fdf4ff', border: '1px solid #f5d0fe' }} styles={{ body: { padding: 12 } }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>Total Group Expenses</Text>
                    <Title level={4} style={{ margin: '2px 0 0', fontSize: 18, color: '#2563eb' }}>
                      ₹{groupDetails.totalGroupExpenses?.toFixed(2)}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 11 }}>{groupDetails.expenses?.length || 0} total expense entries</Text>
                  </Card>
                </Col>

                <Col xs={24} sm={8}>
                  <Card style={{ borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0' }} styles={{ body: { padding: 12 } }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>Group Members</Text>
                    <Title level={4} style={{ margin: '2px 0 0', fontSize: 18, color: '#16a34a' }}>
                      {groupDetails.memberCount || 0} Persons
                    </Title>
                    <Text type="secondary" style={{ fontSize: 11 }}>Full breakdown available below</Text>
                  </Card>
                </Col>
              </Row>

              {/* Audit Tabs */}
              <Tabs
                defaultActiveKey="person-wise"
                type="card"
                style={{ borderRadius: 14 }}
                items={[
                  {
                    key: 'person-wise',
                    label: (
                      <Space size={6}>
                        <UserOutlined />
                        <span>Person-Wise Breakdown ({filteredPersonBreakdown.length})</span>
                      </Space>
                    ),
                    children: (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 6 }}>
                        {/* Member Search & Net Balance Filter Bar */}
                        <Card style={{ borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }} styles={{ body: { padding: 10 } }}>
                          <Row gutter={[10, 10]} align="middle">
                            <Col xs={24} sm={12} md={10}>
                              <Input
                                placeholder="Search member by name, email, phone..."
                                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                                value={memberSearchQuery}
                                onChange={(e) => setMemberSearchQuery(e.target.value)}
                                allowClear
                                size="small"
                              />
                            </Col>

                            <Col xs={24} sm={12} md={10}>
                              <Select
                                value={balanceFilter}
                                onChange={(val) => setBalanceFilter(val)}
                                size="small"
                                style={{ width: '100%' }}
                                options={[
                                  { label: 'All Net Balances', value: 'all' },
                                  { label: 'Owes Dues (Negative Net)', value: 'owe' },
                                  { label: 'Receiving Dues (Positive Net)', value: 'receive' },
                                  { label: 'Fully Settled (Zero Net)', value: 'settled' },
                                ]}
                              />
                            </Col>

                            <Col xs={24} md={4} style={{ textAlign: 'right' }}>
                              <Button size="small" icon={<ClearOutlined />} onClick={clearAllGroupFilters}>
                                Reset Filters
                              </Button>
                            </Col>
                          </Row>
                        </Card>

                        {/* Person-Wise Cards */}
                        {filteredPersonBreakdown.map((pw: any) => (
                          <Card
                            key={pw.member._id}
                            style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                            styles={{ body: { padding: 14 } }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                              <div>
                                <Text strong style={{ fontSize: 15, display: 'block' }}>
                                  <UserOutlined /> {pw.member.fullName}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {pw.member.email} · Phone: {pw.member.phone || 'N/A'}
                                </Text>
                              </div>

                              <Space size={8} wrap>
                                <Tag color="blue" style={{ fontSize: 12, padding: '2px 8px' }}>
                                  Paid: ₹{pw.paidTotal.toFixed(2)}
                                </Tag>
                                <Tag color="orange" style={{ fontSize: 12, padding: '2px 8px' }}>
                                  Owed Share: ₹{pw.shareTotal.toFixed(2)}
                                </Tag>
                                <Tag
                                  color={pw.netBalance >= 0.01 ? 'green' : pw.netBalance <= -0.01 ? 'red' : 'default'}
                                  style={{ fontSize: 12, padding: '2px 8px', fontWeight: 700 }}
                                >
                                  Net Balance: {pw.netBalance >= 0 ? `+₹${pw.netBalance.toFixed(2)}` : `-₹${Math.abs(pw.netBalance).toFixed(2)}`}
                                </Tag>
                              </Space>
                            </div>

                            <Divider style={{ margin: '10px 0' }} />

                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
                              Expenses Involving {pw.member.fullName} ({pw.expenseCount}):
                            </Text>

                            {pw.expenses && pw.expenses.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {pw.expenses.map((exp: any, idx: number) => (
                                  <div
                                    key={idx}
                                    style={{
                                      padding: '8px 10px',
                                      borderRadius: 8,
                                      background: '#f8fafc',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      fontSize: 12,
                                    }}
                                  >
                                    <div>
                                      <Text strong>{exp.title}</Text>
                                      <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                                        Role: {exp.role} · Mode: {exp.paymentMode?.toUpperCase()} · Date: {formatDate(exp.date)}
                                      </Text>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <Text strong style={{ color: '#2563eb' }}>
                                        Total ₹{exp.amount.toFixed(2)}
                                      </Text>
                                      <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                                        Share: ₹{exp.memberShare.toFixed(2)}
                                      </Text>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
                                No expense records recorded for this member.
                              </Text>
                            )}
                          </Card>
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: 'full-expenses',
                    label: (
                      <Space size={6}>
                        <FileTextOutlined />
                        <span>Full Expense History ({filteredExpenses.length})</span>
                      </Space>
                    ),
                    children: (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6 }}>
                        {/* Expense Search & Filters Bar */}
                        <Card style={{ borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }} styles={{ body: { padding: 10 } }}>
                          <Row gutter={[10, 10]} align="middle">
                            <Col xs={24} sm={10} md={8}>
                              <Input
                                placeholder="Search title or paid by..."
                                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                                value={expenseSearchQuery}
                                onChange={(e) => setExpenseSearchQuery(e.target.value)}
                                allowClear
                                size="small"
                              />
                            </Col>

                            <Col xs={12} sm={7} md={6}>
                              <Select
                                value={expensePaymentMode}
                                onChange={(val) => setExpensePaymentMode(val)}
                                size="small"
                                style={{ width: '100%' }}
                                options={[
                                  { label: 'All Modes', value: 'all' },
                                  { label: 'UPI / Online', value: 'upi' },
                                  { label: 'Cash', value: 'cash' },
                                ]}
                              />
                            </Col>

                            <Col xs={12} sm={7} md={6}>
                              <Select
                                value={expenseSortBy}
                                onChange={(val) => setExpenseSortBy(val)}
                                size="small"
                                style={{ width: '100%' }}
                                options={[
                                  { label: 'Sort: Newest', value: 'newest' },
                                  { label: 'Sort: Oldest', value: 'oldest' },
                                  { label: 'Sort: Highest Amount', value: 'amount-high' },
                                  { label: 'Sort: Lowest Amount', value: 'amount-low' },
                                ]}
                              />
                            </Col>

                            <Col xs={24} md={4} style={{ textAlign: 'right' }}>
                              <Button size="small" icon={<ClearOutlined />} onClick={clearAllGroupFilters}>
                                Reset Filters
                              </Button>
                            </Col>
                          </Row>
                        </Card>

                        {/* Paginated Expense Table */}
                        <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
                          <Table
                            dataSource={filteredExpenses}
                            rowKey={(record, idx) => record._id || String(idx)}
                            pagination={{ pageSize: 10 }}
                            scroll={{ x: true }}
                            columns={[
                              {
                                title: 'Expense Title',
                                dataIndex: 'title',
                                key: 'title',
                                render: (text, record) => (
                                  <div>
                                    <Text strong style={{ fontSize: 13 }}>{text}</Text>
                                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                                      {formatDate(record.date || record.createdAt)}
                                    </Text>
                                  </div>
                                ),
                              },
                              {
                                title: 'Paid By',
                                dataIndex: 'paidBy',
                                key: 'paidBy',
                                render: (paidBy) => (
                                  <Text style={{ fontSize: 12 }}>
                                    <UserOutlined /> {paidBy?.fullName || 'N/A'}
                                  </Text>
                                ),
                              },
                              {
                                title: 'Mode',
                                dataIndex: 'paymentMode',
                                key: 'paymentMode',
                                render: (mode) => (
                                  <Tag color={mode?.toLowerCase() === 'upi' ? 'blue' : 'green'} style={{ margin: 0 }}>
                                    {mode?.toUpperCase() || 'CASH'}
                                  </Tag>
                                ),
                              },
                              {
                                title: 'Amount',
                                dataIndex: 'amount',
                                key: 'amount',
                                render: (amt) => (
                                  <Text strong style={{ color: '#2563eb', fontSize: 14 }}>
                                    ₹{amt?.toFixed(2)}
                                  </Text>
                                ),
                              },
                            ]}
                          />
                        </Card>
                      </div>
                    ),
                  },
                  {
                    key: 'settlements',
                    label: (
                      <Space size={6}>
                        <HistoryOutlined />
                        <span>Settlement History ({filteredSettlements.length})</span>
                      </Space>
                    ),
                    children: (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6 }}>
                        {/* Settlement Filter Bar */}
                        <Card style={{ borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }} styles={{ body: { padding: 10 } }}>
                          <Row gutter={[10, 10]} align="middle">
                            <Col xs={24} sm={12} md={10}>
                              <Input
                                placeholder="Search payer or receiver..."
                                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                                value={settlementSearchQuery}
                                onChange={(e) => setSettlementSearchQuery(e.target.value)}
                                allowClear
                                size="small"
                              />
                            </Col>

                            <Col xs={24} sm={12} md={10}>
                              <Select
                                value={settlementStatusFilter}
                                onChange={(val) => setSettlementStatusFilter(val)}
                                size="small"
                                style={{ width: '100%' }}
                                options={[
                                  { label: 'All Statuses', value: 'all' },
                                  { label: 'Completed', value: 'completed' },
                                  { label: 'Pending', value: 'pending' },
                                  { label: 'Rejected', value: 'rejected' },
                                ]}
                              />
                            </Col>

                            <Col xs={24} md={4} style={{ textAlign: 'right' }}>
                              <Button size="small" icon={<ClearOutlined />} onClick={clearAllGroupFilters}>
                                Reset Filters
                              </Button>
                            </Col>
                          </Row>
                        </Card>

                        {/* Paginated Settlement Table */}
                        <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
                          <Table
                            dataSource={filteredSettlements}
                            rowKey={(record, idx) => record._id || String(idx)}
                            pagination={{ pageSize: 10 }}
                            scroll={{ x: true }}
                            columns={[
                              {
                                title: 'Transfer Details',
                                key: 'transfer',
                                render: (_, record) => (
                                  <div>
                                    <Text strong style={{ fontSize: 13 }}>
                                      {record.payer?.fullName} ➔ {record.receiver?.fullName}
                                    </Text>
                                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                                      Method: {record.paymentMethod?.toUpperCase() || 'UPI'} · Date: {formatDate(record.createdAt)}
                                    </Text>
                                  </div>
                                ),
                              },
                              {
                                title: 'Amount',
                                dataIndex: 'amount',
                                key: 'amount',
                                render: (amt) => (
                                  <Text strong style={{ color: '#16a34a', fontSize: 14 }}>
                                    ₹{amt?.toFixed(2)}
                                  </Text>
                                ),
                              },
                              {
                                title: 'Status',
                                dataIndex: 'status',
                                key: 'status',
                                render: (status) => (
                                  <Tag
                                    color={status === 'completed' ? 'green' : status === 'rejected' ? 'red' : 'orange'}
                                    style={{ margin: 0 }}
                                  >
                                    {status?.toUpperCase() || 'COMPLETED'}
                                  </Tag>
                                ),
                              },
                            ]}
                          />
                        </Card>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default InspectorDashboard;
