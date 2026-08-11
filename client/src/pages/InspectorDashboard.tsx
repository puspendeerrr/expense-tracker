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
  Flex,
  Pagination,
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
  MobileOutlined,
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

  // Group audit filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterMode, setFilterMode] = useState<string>('all'); // all, cash, upi
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest'); // newest, oldest, highest, lowest

  // Pagination states
  const [expensePage, setExpensePage] = useState<number>(1);
  const [settlementPage, setSettlementPage] = useState<number>(1);
  const pageSize = 10;

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
      setExpensePage(1);
      setSettlementPage(1);
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
        });
  };

  // Group Select Options
  const groupSelectOptions = useMemo(() => {
    return groups.map((g) => ({
      label: `${g.name} (${g.memberCount} members · ₹${g.totalExpenseSum.toFixed(2)})`,
      value: g._id,
    }));
  }, [groups]);

  // Member Filter Options for selected group
  const memberSelectOptions = useMemo(() => {
    const opts = [{ label: 'All Members', value: 'all' }];
    if (groupDetails?.members) {
      groupDetails.members.forEach((m: any) => {
        opts.push({
          label: m.fullName || m.email,
          value: m._id,
        });
      });
    }
    return opts;
  }, [groupDetails]);

  // Processed and filtered expenses
  const processedExpenses = useMemo(() => {
    if (!groupDetails?.expenses) return [];
    let list = groupDetails.expenses.filter((exp: any) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        exp.title?.toLowerCase().includes(q) ||
        exp.paidBy?.fullName?.toLowerCase().includes(q) ||
        (exp.notes && exp.notes.toLowerCase().includes(q));

      const matchesMode = filterMode === 'all' || exp.paymentMode?.toLowerCase() === filterMode;

      let matchesMember = true;
      if (memberFilter !== 'all') {
        const paidById = typeof exp.paidBy === 'object' ? exp.paidBy?._id : exp.paidBy;
        const isPayer = paidById?.toString() === memberFilter;

        let isParticipant = false;
        if (exp.splitType === 'everyone') {
          isParticipant = true;
        } else if (exp.splitDetails && Array.isArray(exp.splitDetails)) {
          isParticipant = exp.splitDetails.some((s: any) => {
            const sId = typeof s.user === 'object' ? s.user?._id : s.user;
            return sId?.toString() === memberFilter;
          });
        }
        matchesMember = isPayer || isParticipant;
      }

      return matchesSearch && matchesMode && matchesMember;
    });

    list.sort((a: any, b: any) => {
      const timeA = new Date(a.date || a.createdAt || 0).getTime();
      const timeB = new Date(b.date || b.createdAt || 0).getTime();
      if (sortBy === 'newest') return timeB - timeA;
      if (sortBy === 'oldest') return timeA - timeB;
      if (sortBy === 'highest') return b.amount - a.amount;
      if (sortBy === 'lowest') return a.amount - b.amount;
      return 0;
    });

    return list;
  }, [groupDetails, searchTerm, filterMode, memberFilter, sortBy]);

  // Filtered person-wise breakdown
  const processedPersonBreakdown = useMemo(() => {
    if (!groupDetails?.personWiseBreakdown) return [];
    let list = groupDetails.personWiseBreakdown;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (pw: any) =>
          pw.member.fullName?.toLowerCase().includes(q) ||
          pw.member.email?.toLowerCase().includes(q) ||
          pw.member.phone?.includes(q)
      );
    }

    if (memberFilter !== 'all') {
      list = list.filter((pw: any) => pw.member._id === memberFilter);
    }

    return list;
  }, [groupDetails, searchTerm, memberFilter]);

  // Filtered settlements
  const processedSettlements = useMemo(() => {
    if (!groupDetails?.settlements) return [];
    let list = groupDetails.settlements;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (s: any) =>
          s.payer?.fullName?.toLowerCase().includes(q) ||
          s.receiver?.fullName?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [groupDetails, searchTerm]);

  // Paginated expenses
  const paginatedExpenses = useMemo(() => {
    const start = (expensePage - 1) * pageSize;
    return processedExpenses.slice(start, start + pageSize);
  }, [processedExpenses, expensePage]);

  // Paginated settlements
  const paginatedSettlements = useMemo(() => {
    const start = (settlementPage - 1) * pageSize;
    return processedSettlements.slice(start, start + pageSize);
  }, [processedSettlements, settlementPage]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Inspector Banner */}
      <Alert
        message={
          <Space align="center" size={8}>
            <SafetyCertificateOutlined style={{ fontSize: 18, color: '#722ed1' }} />
            <Text strong style={{ fontSize: 14, color: '#581c87' }}>
              Inspector Audit Console (Read-Only Mode)
            </Text>
          </Space>
        }
        description="Logged in as inspect@gmail.com. You have global audit access to inspect all listed groups, full expense history, person-wise expense shares, and settlement records."
        type="info"
        showIcon={false}
        style={{
          borderRadius: 14,
          background: 'linear-gradient(135deg, #f9f5ff 0%, #f3e8ff 100%)',
          border: '1px solid #d8b4fe',
          boxShadow: '0 2px 8px rgba(114, 46, 209, 0.05)',
        }}
      />

      {/* Global Summary Statistics Row */}
      <Row gutter={[10, 10]}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 14, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 12 } }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}><DollarOutlined /> Total Platform Spend</Text>}
              value={analytics?.summary?.totalExpenseVolume || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#2563eb', fontWeight: 700, fontSize: 18 }}
            />
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
              {analytics?.summary?.totalExpenseCount || 0} expenses across {groups.length} groups
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 14, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 12 } }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}><FolderOutlined /> Groups Listed</Text>}
              value={groups.length}
              valueStyle={{ color: '#0d9488', fontWeight: 700, fontSize: 18 }}
            />
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
              {analytics?.summary?.totalUsers || 0} platform users
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 14, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 12 } }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}><HistoryOutlined /> Settlement Volume</Text>}
              value={analytics?.settlementStats?.completedVolume || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#16a34a', fontWeight: 700, fontSize: 18 }}
            />
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
              {analytics?.settlementStats?.completedCount || 0} completed settlements
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 14, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 12 } }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 11 }}><BarChartOutlined /> Avg Expense Size</Text>}
              value={analytics?.summary?.avgExpenseAmount || 0}
              precision={2}
              prefix="₹"
              valueStyle={{ color: '#7c3aed', fontWeight: 700, fontSize: 18 }}
            />
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
              MongoDB Aggregation
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Main View Segmented Selector & Refresh Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Segmented
          value={activeTab}
          onChange={(val) => setActiveTab(val as string)}
          size="middle"
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
                  <span>Platform Analytics</span>
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
          size="middle"
          style={{ borderRadius: 10 }}
        >
          Refresh
        </Button>
      </div>

      {activeTab === 'analytics' ? (
        /* Analytics View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Row gutter={[14, 14]}>
            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <WalletOutlined style={{ color: '#2563eb' }} />
                    <span>Payment Mode Breakdown (Aggregation)</span>
                  </Space>
                }
                style={{ borderRadius: 14, height: '100%' }}
              >
                {analytics?.summary ? (
                  <Flex vertical gap={16}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text strong><BankOutlined /> UPI / Online Payments</Text>
                        <Text strong style={{ color: '#2563eb' }}>
                          ₹{analytics.summary.upiVolume.toFixed(2)} ({analytics.summary.upiCount} entries)
                        </Text>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text strong><DollarOutlined /> Cash Payments</Text>
                        <Text strong style={{ color: '#16a34a' }}>
                          ₹{analytics.summary.cashVolume.toFixed(2)} ({analytics.summary.cashCount} entries)
                        </Text>
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
                  </Flex>
                ) : (
                  <Spin />
                )}
              </Card>
            </Col>

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
                  <Flex vertical gap={8}>
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
                  </Flex>
                ) : (
                  <Text type="secondary">No spending records available.</Text>
                )}
              </Card>
            </Col>
          </Row>

          <Card
            title={
              <Space>
                <FolderOutlined style={{ color: '#7c3aed' }} />
                <span>All Listed Groups Audit</span>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Header Controls (Matching Expenses page design exactly) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <Title level={4} style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                Group Audit: {groupDetails?.group?.name || 'Loading...'}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Total Tracked: <strong className="financial-num" style={{ color: '#2563eb' }}>₹{(groupDetails?.totalGroupExpenses || 0).toFixed(2)}</strong>
              </Text>
            </div>

            <div style={{ minWidth: 260, flex: 1, maxWidth: 400 }}>
              <Select
                value={selectedGroupId}
                onChange={(val) => setSelectedGroupId(val)}
                loading={isLoadingGroups}
                style={{ width: '100%' }}
                size="middle"
                options={groupSelectOptions}
                placeholder="Select group to inspect"
              />
            </div>
          </div>

          {/* Filter & Search Bar (Matching Expenses page screenshot design) */}
          <Card style={{ borderRadius: 14 }} styles={{ body: { padding: 12 } }}>
            <Flex vertical gap={10}>
              <Input
                placeholder="Search bills, flatmates or notes..."
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setExpensePage(1);
                  setSettlementPage(1);
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
                    setExpensePage(1);
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
                    setExpensePage(1);
                  }}
                  style={{ flex: 1, minWidth: 170 }}
                  size="middle"
                  options={memberSelectOptions}
                  placeholder="Filter by Member"
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

          {/* Detailed Group Audit View */}
          {isLoadingDetails ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Spin size="large" />
              <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 13 }}>
                Loading group inspection audit data...
              </Text>
            </div>
          ) : groupDetails ? (
            <Tabs
              defaultActiveKey="full-expenses"
              type="card"
              style={{ borderRadius: 14 }}
              items={[
                {
                  key: 'full-expenses',
                  label: (
                    <Space size={6}>
                      <FileTextOutlined />
                      <span>Full Expense History ({processedExpenses.length})</span>
                    </Space>
                  ),
                  children: (
                    <Card style={{ borderRadius: 14 }} styles={{ body: { padding: 0 } }}>
                      <Flex vertical>
                        {paginatedExpenses.length > 0 ? (
                          paginatedExpenses.map((exp: any, idx: number) => (
                            <div
                              key={exp._id || idx}
                              style={{
                                padding: '12px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: idx !== paginatedExpenses.length - 1 ? '1px solid #f1f5f9' : 'none',
                              }}
                            >
                              <Flex align="center" gap={12}>
                                <div>
                                  <Text strong style={{ fontSize: 14, color: '#1e293b', display: 'block' }}>
                                    {exp.title}
                                  </Text>

                                  <Flex align="center" gap={6} style={{ marginTop: 2 }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                      Paid by {exp.paidBy?.fullName || 'Flatmate'}
                                    </Text>
                                    <Text type="secondary" style={{ fontSize: 12 }}>•</Text>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                      {formatDate(exp.date || exp.createdAt)}
                                    </Text>
                                    <Tag
                                      color={exp.paymentMode?.toLowerCase() === 'upi' ? 'blue' : 'green'}
                                      style={{ margin: 0, borderRadius: 6, fontSize: 10, padding: '0 6px' }}
                                    >
                                      {exp.paymentMode?.toLowerCase() === 'upi' ? (
                                        <Space size={2}><MobileOutlined /> UPI</Space>
                                      ) : (
                                        <Space size={2}><DollarOutlined /> Cash</Space>
                                      )}
                                    </Tag>
                                  </Flex>
                                </div>
                              </Flex>

                              <div style={{ textAlign: 'right' }}>
                                <Text strong className="financial-num" style={{ fontSize: 16, color: '#2563eb', display: 'block' }}>
                                  ₹{exp.amount.toFixed(2)}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                                  {exp.splitType === 'everyone' ? 'Split All' : `${exp.splitDetails?.length || 0} shares`}
                                </Text>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ padding: '40px 0', textAlign: 'center' }}>
                            <Text type="secondary">No expenses found matching the active filters.</Text>
                          </div>
                        )}
                      </Flex>

                      {processedExpenses.length > pageSize && (
                        <div style={{ padding: 12, display: 'flex', justifyContent: 'center', borderTop: '1px solid #f1f5f9' }}>
                          <Pagination
                            current={expensePage}
                            pageSize={pageSize}
                            total={processedExpenses.length}
                            onChange={(p) => setExpensePage(p)}
                            size="small"
                          />
                        </div>
                      )}
                    </Card>
                  ),
                },
                {
                  key: 'person-wise',
                  label: (
                    <Space size={6}>
                      <UserOutlined />
                      <span>Person-Wise Breakdown ({processedPersonBreakdown.length})</span>
                    </Space>
                  ),
                  children: (
                    <Flex vertical gap={12} style={{ paddingTop: 6 }}>
                      {processedPersonBreakdown.map((pw: any) => (
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
                            <Flex vertical gap={6}>
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
                            </Flex>
                          ) : (
                            <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
                              No expense records recorded for this member.
                            </Text>
                          )}
                        </Card>
                      ))}
                    </Flex>
                  ),
                },
                {
                  key: 'settlements',
                  label: (
                    <Space size={6}>
                      <HistoryOutlined />
                      <span>Settlement History ({processedSettlements.length})</span>
                    </Space>
                  ),
                  children: (
                    <Card style={{ borderRadius: 14, marginTop: 6 }} styles={{ body: { padding: 0 } }}>
                      <Flex vertical>
                        {paginatedSettlements.length > 0 ? (
                          paginatedSettlements.map((set: any, idx: number) => (
                            <div
                              key={set._id || idx}
                              style={{
                                padding: '12px 14px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: idx !== paginatedSettlements.length - 1 ? '1px solid #f1f5f9' : 'none',
                              }}
                            >
                              <div>
                                <Text strong style={{ fontSize: 13, display: 'block' }}>
                                  {set.payer?.fullName} ➔ {set.receiver?.fullName}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  Method: {set.paymentMethod?.toUpperCase() || 'UPI'} · Date: {formatDate(set.createdAt)}
                                </Text>
                              </div>

                              <div style={{ textAlign: 'right' }}>
                                <Text strong style={{ fontSize: 15, color: '#16a34a', display: 'block' }}>
                                  ₹{set.amount.toFixed(2)}
                                </Text>
                                <Tag
                                  color={set.status === 'completed' ? 'green' : set.status === 'rejected' ? 'red' : 'orange'}
                                  style={{ fontSize: 10, margin: 0 }}
                                >
                                  {set.status?.toUpperCase() || 'COMPLETED'}
                                </Tag>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ padding: '40px 0', textAlign: 'center' }}>
                            <Text type="secondary">No settlement records found.</Text>
                          </div>
                        )}
                      </Flex>

                      {processedSettlements.length > pageSize && (
                        <div style={{ padding: 12, display: 'flex', justifyContent: 'center', borderTop: '1px solid #f1f5f9' }}>
                          <Pagination
                            current={settlementPage}
                            pageSize={pageSize}
                            total={processedSettlements.length}
                            onChange={(p) => setSettlementPage(p)}
                            size="small"
                          />
                        </div>
                      )}
                    </Card>
                  ),
                },
              ]}
            />
          ) : null}
        </div>
      )}
    </div>
  );
};

export default InspectorDashboard;
