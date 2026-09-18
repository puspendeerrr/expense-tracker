import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Typography,
  Button,
  Space,
  Tooltip,
  Avatar,
  Dropdown,
  Badge,
  Popover,
  Empty,
  Drawer,
  Tag,
  Grid,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  UserOutlined,
  CopyOutlined,
  CheckOutlined,
  WalletOutlined,
  LogoutOutlined,
  BellOutlined,
  DollarOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  CrownOutlined,
  MenuOutlined,
  DashboardOutlined,
  FileTextOutlined,
  HistoryOutlined,
  RightOutlined,
  QrcodeOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../ui/Toast';
import { GroupQRModal } from '../modals/GroupQRModal';

const { Text } = Typography;
const { useBreakpoint } = Grid;

const getNotifIcon = (type: string) => {
  const base = { fontSize: 14 };
  switch (type) {
    case 'expense_added':
    case 'expense:created':
      return <DollarOutlined style={{ ...base, color: '#2563eb' }} />;
    case 'expense_updated':
    case 'expense:updated':
      return <EditOutlined style={{ ...base, color: '#d97706' }} />;
    case 'expense_deleted':
    case 'expense:deleted':
      return <DeleteOutlined style={{ ...base, color: '#dc2626' }} />;
    case 'settlement_requested':
    case 'settlement:created':
    case 'settlement:submitted':
      return <SafetyCertificateOutlined style={{ ...base, color: '#7c3aed' }} />;
    case 'settlement_approved':
    case 'settlement:verified':
    case 'settlement:approved':
      return <CheckCircleOutlined style={{ ...base, color: '#16a34a' }} />;
    case 'settlement_rejected':
    case 'settlement:rejected':
      return <CloseCircleOutlined style={{ ...base, color: '#dc2626' }} />;
    case 'group_member_joined':
    case 'group:member_joined':
      return <TeamOutlined style={{ ...base, color: '#06b6d4' }} />;
    default:
      return <BellOutlined style={{ ...base, color: '#2563eb' }} />;
  }
};

const formatTimeAgo = (ts: string) => {
  if (!ts) return '';
  const diffMs = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
};

/** The sidebar owns navigation, so the navbar states *where you are* instead of re-branding. */
const PAGE_TITLES: { match: (path: string) => boolean; title: string; subtitle?: string }[] = [
  { match: (p) => p === '/' || p === '/dashboard', title: 'Dashboard' },
  { match: (p) => p === '/expenses', title: 'Expenses' },
  { match: (p) => p === '/members', title: 'Members & Dues' },
  { match: (p) => p === '/history' || p === '/settlements', title: 'Settlement History' },
  { match: (p) => p === '/profile', title: 'Profile & Settings' },
  { match: (p) => p === '/admin', title: 'Admin Console' },
  { match: (p) => p === '/inspector', title: 'Inspector Console' },
  { match: (p) => p === '/no-group', title: 'Get Started' },
];

export const Navbar: React.FC = () => {
  const { group, user, userRole, logout } = useAuth();
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications();
  const { showSuccess, confirmAction } = useToast();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [copied, setCopied] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isGroupQROpen, setIsGroupQROpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isSuperAdmin = user?.isSuperAdmin || user?.email === 'admin@gmail.com';
  const isInspector = user?.isInspector || user?.email === 'inspect@gmail.com';

  const page = PAGE_TITLES.find((p) => p.match(location.pathname));

  const copyInviteCode = () => {
    if (group?.inviteCode) {
      navigator.clipboard.writeText(group.inviteCode);
      setCopied(true);
      showSuccess(`Invite code ${group.inviteCode} copied!`);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSignOut = () => {
    confirmAction({
      title: 'Sign Out',
      content: 'Are you sure you want to sign out?',
      onOk: () => {
        setMobileDrawerOpen(false);
        logout();
        navigate('/login');
      },
      danger: true,
    });
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'identity',
      label: (
        <div style={{ padding: '4px 2px', minWidth: 190 }}>
          <Text strong style={{ fontSize: 13, display: 'block', lineHeight: 1.3 }}>
            {user?.fullName}
          </Text>
          <Text type="secondary" style={{ fontSize: 11, display: 'block' }} ellipsis>
            {user?.email}
          </Text>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    ...(isSuperAdmin
      ? [
          { key: 'admin', icon: <CrownOutlined style={{ color: '#faad14' }} />, label: 'Super Admin Console', onClick: () => navigate('/admin') },
          { key: 'profile', icon: <UserOutlined />, label: 'Admin Account', onClick: () => navigate('/profile') },
        ]
      : isInspector
        ? [
            { key: 'inspector', icon: <SafetyCertificateOutlined style={{ color: '#722ed1' }} />, label: 'Inspector Audit Console', onClick: () => navigate('/inspector') },
            { key: 'profile', icon: <UserOutlined />, label: 'Inspector Account', onClick: () => navigate('/profile') },
          ]
        : [
            { key: 'profile', icon: <UserOutlined />, label: 'My Profile & Settings', onClick: () => navigate('/profile') },
          ]),
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, danger: true, label: 'Sign Out', onClick: handleSignOut },
  ];

  const mobileNavItems = isSuperAdmin
    ? [
        { label: 'Admin Console', path: '/admin', icon: <CrownOutlined /> },
        { label: 'Admin Profile', path: '/profile', icon: <UserOutlined /> },
      ]
    : isInspector
      ? [
          { label: 'Inspector Console', path: '/inspector', icon: <SafetyCertificateOutlined /> },
          { label: 'Inspector Profile', path: '/profile', icon: <UserOutlined /> },
        ]
      : [
          { label: 'Dashboard', path: '/dashboard', icon: <DashboardOutlined /> },
          { label: 'Expenses', path: '/expenses', icon: <FileTextOutlined /> },
          { label: 'Members & Dues', path: '/members', icon: <TeamOutlined /> },
          { label: 'Settlement History', path: '/history', icon: <HistoryOutlined /> },
          { label: 'My Profile', path: '/profile', icon: <UserOutlined /> },
        ];

  const handleNotifClick = (notif: { type: string }) => {
    setNotifOpen(false);
    if (notif.type.startsWith('expense')) navigate('/expenses');
    else if (notif.type.startsWith('settlement')) navigate('/history');
    else if (notif.type.includes('member_joined')) navigate('/members');
  };

  const notificationList = (
    <div className="nav-notif">
      <div className="nav-notif__head">
        <Space size={7} align="center">
          <Text strong style={{ fontSize: 13.5 }}>Notifications</Text>
          {unreadCount > 0 && (
            <Tag color="blue" style={{ margin: 0, fontSize: 10, borderRadius: 10, padding: '0 7px' }}>
              {unreadCount} new
            </Tag>
          )}
        </Space>
        {unreadCount > 0 && (
          <Button type="link" size="small" onClick={markAllAsRead} style={{ fontSize: 11.5, padding: 0, height: 'auto' }}>
            Mark all read
          </Button>
        )}
      </div>

      <div className="nav-notif__body">
        {notifications.length > 0 ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {notifications.slice(0, 20).map((notif) => (
              <li key={notif._id}>
                <button
                  type="button"
                  className={`nav-notif__item${notif.read ? '' : ' nav-notif__item--unread'}`}
                  onClick={() => {
                    markAsRead(notif._id);
                    handleNotifClick(notif);
                  }}
                >
                  <span className="nav-notif__icon">{getNotifIcon(notif.type)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {notif.title && (
                      <Text strong style={{ fontSize: 12.5, display: 'block', lineHeight: 1.35 }}>
                        {notif.title}
                      </Text>
                    )}
                    <Text
                      style={{ fontSize: 11.5, display: 'block', lineHeight: 1.45, color: '#475569' }}
                    >
                      {notif.message}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 10, marginTop: 3, display: 'block' }}>
                      {formatTimeAgo(notif.createdAt)}
                    </Text>
                  </span>
                  {!notif.read && <span className="nav-notif__dot" aria-label="Unread" />}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<Text type="secondary" style={{ fontSize: 12.5 }}>You&rsquo;re all caught up</Text>}
            style={{ padding: '28px 0' }}
          />
        )}
      </div>
    </div>
  );

  const bellButton = (
    <Badge count={unreadCount} size="small" offset={[-3, 3]}>
      <Button
        type="text"
        className="nav-iconbtn"
        icon={<BellOutlined style={{ fontSize: 17 }} />}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      />
    </Badge>
  );

  return (
    <>
      <header className="app-navbar">
        {/* ── Left: context ───────────────────────────────────── */}
        <div className="app-navbar__left">
          <Button
            type="text"
            className="nav-iconbtn nav-iconbtn--menu"
            icon={<MenuOutlined style={{ fontSize: 17 }} />}
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open navigation menu"
          />

          {/* Mobile keeps the brand lockup; desktop already has it in the sidebar. */}
          <button
            type="button"
            className="nav-brand"
            onClick={() => navigate(isSuperAdmin ? '/admin' : '/dashboard')}
            aria-label="Go to dashboard"
          >
            <span className="nav-brand__mark">
              <WalletOutlined style={{ color: '#ffffff', fontSize: 15 }} aria-hidden="true" />
            </span>
            <span className="nav-brand__text">
              <Text strong style={{ fontSize: 13.5, display: 'block', lineHeight: 1.25 }}>
                SplitWise
              </Text>
              <Text type="secondary" ellipsis style={{ fontSize: 10.5, display: 'block', lineHeight: 1.25 }}>
                {group ? group.name : isSuperAdmin ? 'Platform Super Admin' : 'No active group'}
              </Text>
            </span>
          </button>

          {/* Desktop: say which page this is, rather than repeating the brand. */}
          <div className="nav-pagetitle">
            <Text strong style={{ fontSize: 15.5, lineHeight: 1.2 }}>
              {page?.title || 'SplitWise'}
            </Text>
            {group && !isSuperAdmin && !isInspector && (
              <Text type="secondary" ellipsis style={{ fontSize: 11.5, display: 'block', lineHeight: 1.25 }}>
                {group.name}
              </Text>
            )}
          </div>
        </div>

        {/* ── Right: actions ──────────────────────────────────── */}
        <div className="app-navbar__right">
          {isSuperAdmin && (
            <Tag color="gold" icon={<CrownOutlined />} className="nav-roletag">Admin</Tag>
          )}
          {isInspector && (
            <Tag color="purple" icon={<SafetyCertificateOutlined />} className="nav-roletag">Inspector</Tag>
          )}

          {/* Invite actions live in the sidebar on desktop, so they only show on mobile. */}
          {!isSuperAdmin && group && (
            <>
              <Tooltip title="Show group QR code">
                <Button
                  type="text"
                  className="nav-iconbtn nav-invite-only-mobile"
                  onClick={() => setIsGroupQROpen(true)}
                  icon={<QrcodeOutlined style={{ fontSize: 17, color: '#2563eb' }} />}
                  aria-label="Show group QR code"
                />
              </Tooltip>

              <Tooltip title={copied ? 'Copied!' : 'Copy invite code'}>
                <Button
                  onClick={copyInviteCode}
                  className="nav-codechip nav-invite-only-mobile"
                  icon={
                    copied
                      ? <CheckOutlined style={{ color: '#16a34a' }} />
                      : <CopyOutlined style={{ color: '#64748b' }} />
                  }
                  aria-label={`Copy invite code ${group.inviteCode}`}
                >
                  {group.inviteCode}
                </Button>
              </Tooltip>
            </>
          )}

          {user && (
            isMobile ? (
              <span onClick={() => setNotifOpen(true)}>{bellButton}</span>
            ) : (
              <Popover
                content={notificationList}
                trigger="click"
                placement="bottomRight"
                open={notifOpen}
                onOpenChange={setNotifOpen}
                arrow={false}
                styles={{ container: { padding: 0, borderRadius: 14, overflow: 'hidden' } }}
              >
                {bellButton}
              </Popover>
            )
          )}

          {user && (
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              trigger={['click']}
              arrow
            >
              <button type="button" className="nav-avatarbtn" aria-label="Account menu">
                <Avatar
                  style={{
                    backgroundColor: isSuperAdmin ? '#faad14' : '#0f172a',
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                  size={32}
                  icon={isSuperAdmin ? <CrownOutlined /> : <UserOutlined />}
                >
                  {!isSuperAdmin && user.fullName?.charAt(0).toUpperCase()}
                </Avatar>
              </button>
            </Dropdown>
          )}
        </div>
      </header>

      {/* Mobile notifications: a bottom sheet is far easier to hit than a corner popover. */}
      <Drawer
        open={isMobile && notifOpen}
        onClose={() => setNotifOpen(false)}
        placement="bottom"
        height="72%"
        title={null}
        closable={false}
        styles={{ body: { padding: 0 }, header: { display: 'none' } }}
      >
        {notificationList}
      </Drawer>

      {/* ── Mobile navigation drawer ──────────────────────────── */}
      <Drawer
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        placement="left"
        width={286}
        closable={false}
        styles={{
          body: { padding: '18px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
          header: { display: 'none' },
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Identity tile */}
          <div
            style={{
              padding: '13px 14px',
              backgroundColor: '#f8fafc',
              borderRadius: 13,
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 11,
            }}
          >
            <Avatar
              size={42}
              style={{ backgroundColor: isSuperAdmin ? '#faad14' : '#0f172a', fontSize: 16, fontWeight: 600, flexShrink: 0 }}
              icon={isSuperAdmin ? <CrownOutlined /> : <UserOutlined />}
            >
              {!isSuperAdmin && user?.fullName?.charAt(0).toUpperCase()}
            </Avatar>
            <div style={{ minWidth: 0, flex: 1 }}>
              <Text strong ellipsis style={{ fontSize: 13.5, display: 'block', lineHeight: 1.3 }}>
                {user?.fullName}
              </Text>
              <Text type="secondary" ellipsis style={{ fontSize: 11, display: 'block' }}>
                {user?.email}
              </Text>
              {isSuperAdmin ? (
                <Tag color="gold" style={{ fontSize: 10, marginTop: 5, borderRadius: 4 }}>Super Admin</Tag>
              ) : (
                userRole && (
                  <Tag color={userRole === 'creator' ? 'gold' : 'blue'} style={{ fontSize: 10, marginTop: 5, borderRadius: 4 }}>
                    {userRole === 'creator' ? 'Group Admin' : 'Member'}
                  </Tag>
                )
              )}
            </div>
          </div>

          {/* Group + invite */}
          {!isSuperAdmin && group && (
            <div
              style={{
                padding: '11px 12px',
                backgroundColor: 'rgba(37, 99, 235, 0.04)',
                borderRadius: 11,
                border: '1px solid rgba(37, 99, 235, 0.15)',
              }}
            >
              <Text type="secondary" style={{ fontSize: 10, display: 'block', fontWeight: 600 }}>
                ACTIVE GROUP
              </Text>
              <Text strong ellipsis style={{ fontSize: 12.5, display: 'block', marginBottom: 8 }}>
                {group.name}
              </Text>
              <Space size={6} style={{ width: '100%' }}>
                <Button
                  size="small"
                  icon={copied ? <CheckOutlined style={{ color: '#16a34a' }} /> : <CopyOutlined />}
                  onClick={copyInviteCode}
                  style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, borderRadius: 7, flex: 1 }}
                >
                  {group.inviteCode}
                </Button>
                <Button
                  size="small"
                  icon={<QrcodeOutlined style={{ color: '#2563eb' }} />}
                  onClick={() => { setMobileDrawerOpen(false); setIsGroupQROpen(true); }}
                  style={{ borderRadius: 7 }}
                  aria-label="Show group QR code"
                />
              </Space>
            </div>
          )}

          {/* Navigation */}
          <nav aria-label="Main navigation" style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', padding: '0 4px 4px' }}>
              MENU
            </Text>
            {mobileNavItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path === '/history' && location.pathname === '/settlements');

              return (
                <button
                  type="button"
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setMobileDrawerOpen(false);
                  }}
                  className={`nav-drawer-link${isActive ? ' nav-drawer-link--active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <span style={{ color: isActive ? '#2563eb' : '#64748b', fontSize: 16, display: 'flex' }}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </span>
                  <RightOutlined style={{ fontSize: 10, color: isActive ? '#2563eb' : '#cbd5e1' }} aria-hidden="true" />
                </button>
              );
            })}
          </nav>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 13, marginTop: 14 }}>
          <Button danger block icon={<LogoutOutlined />} onClick={handleSignOut} style={{ borderRadius: 10, height: 40 }}>
            Sign Out
          </Button>
        </div>
      </Drawer>

      <GroupQRModal isOpen={isGroupQROpen} onClose={() => setIsGroupQROpen(false)} />
    </>
  );
};
