import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Typography, Button, Space, Avatar, Tooltip, Tag } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  TeamOutlined,
  HistoryOutlined,
  UserOutlined,
  LogoutOutlined,
  CopyOutlined,
  CheckOutlined,
  WalletOutlined,
  CrownOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';

const { Text, Title } = Typography;

export const DesktopSidebar: React.FC = () => {
  const { user, group, userRole, logout } = useAuth();
  const { showSuccess, confirmAction } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const isSuperAdmin = user?.isSuperAdmin || user?.email === 'admin@gmail.com';
  const isInspector = user?.isInspector || user?.email === 'inspect@gmail.com';

  const copyInviteCode = () => {
    if (group?.inviteCode) {
      navigator.clipboard.writeText(group.inviteCode);
      setCopied(true);
      showSuccess(`Invite code ${group.inviteCode} copied to clipboard!`);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSignOut = () => {
    confirmAction({
      title: 'Sign Out',
      content: 'Are you sure you want to sign out of your account?',
      onOk: () => {
        logout();
        navigate('/login');
      },
      danger: true,
    });
  };

  const navItems = isSuperAdmin
    ? [
        { label: 'Admin Console', path: '/admin', icon: <CrownOutlined style={{ fontSize: 17 }} /> },
        { label: 'Admin Profile', path: '/profile', icon: <UserOutlined style={{ fontSize: 17 }} /> },
      ]
    : isInspector
    ? [
        { label: 'Inspector Console', path: '/inspector', icon: <SafetyCertificateOutlined style={{ fontSize: 17 }} /> },
        { label: 'Inspector Profile', path: '/profile', icon: <UserOutlined style={{ fontSize: 17 }} /> },
      ]
    : [
        { label: 'Dashboard', path: '/dashboard', icon: <DashboardOutlined style={{ fontSize: 17 }} /> },
        { label: 'Expenses', path: '/expenses', icon: <FileTextOutlined style={{ fontSize: 17 }} /> },
        { label: 'Members & Dues', path: '/members', icon: <TeamOutlined style={{ fontSize: 17 }} /> },
        { label: 'Settlement History', path: '/history', icon: <HistoryOutlined style={{ fontSize: 17 }} /> },
        { label: 'My Account', path: '/profile', icon: <UserOutlined style={{ fontSize: 17 }} /> },
      ];

  return (
    <aside
      className="hidden md:flex flex-col justify-between"
      style={{
        width: 240,
        minWidth: 240,
        maxWidth: 240,
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        minHeight: '100dvh',
        height: '100dvh',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '16px 14px',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {/* Top Brand & Group Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Brand Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            padding: '4px 6px',
          }}
          onClick={() => navigate(isSuperAdmin ? '/admin' : '/dashboard')}
        >
          <img
            src="/favicon.svg"
            alt="Splitwise Logo"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
            }}
          />
          <div>
            <Title level={5} style={{ margin: 0, fontSize: 15, lineHeight: 1.2, fontWeight: 700 }}>
              Splitwise Pro
            </Title>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              {isSuperAdmin ? 'Platform Super Admin' : 'Expense & Settlement'}
            </Text>
          </div>
        </div>

        {/* Active Group Card (Normal Users only) */}
        {!isSuperAdmin && group && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#f8fafc',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong ellipsis style={{ fontSize: 13, maxWidth: 140 }}>
                {group.name}
              </Text>
              <Tag
                color={userRole === 'creator' ? 'gold' : 'blue'}
                style={{ margin: 0, fontSize: 10, borderRadius: 4, padding: '0 4px' }}
              >
                {userRole === 'creator' ? 'Admin' : 'Member'}
              </Tag>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Code: <Text code style={{ fontSize: 11 }}>{group.inviteCode}</Text>
              </Text>
              <Tooltip title="Copy invite code">
                <Button
                  size="small"
                  type="text"
                  icon={copied ? <CheckOutlined style={{ color: '#16a34a' }} /> : <CopyOutlined />}
                  onClick={copyInviteCode}
                  style={{ height: 22, width: 22, padding: 0 }}
                />
              </Tooltip>
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path === '/history' && location.pathname === '/settlements');

            return (
              <NavLink
                key={item.path}
                to={item.path}
                style={{
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#2563eb' : '#475569',
                  backgroundColor: isActive ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ color: isActive ? '#2563eb' : '#64748b' }}>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Footer Profile & Logout */}
      <div
        style={{
          paddingTop: 12,
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px' }}>
          <Avatar
            size={34}
            style={{
              backgroundColor: isSuperAdmin ? '#faad14' : '#0f172a',
              fontSize: 13,
              fontWeight: 600,
            }}
            icon={isSuperAdmin ? <CrownOutlined /> : <UserOutlined />}
          >
            {!isSuperAdmin && user?.fullName?.charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Text strong ellipsis style={{ fontSize: 13, display: 'block', lineHeight: 1.2 }}>
              {user?.fullName}
            </Text>
            <Text type="secondary" ellipsis style={{ fontSize: 11, display: 'block', lineHeight: 1.2 }}>
              {user?.email}
            </Text>
          </div>
        </div>

        <Button
          danger
          type="text"
          icon={<LogoutOutlined />}
          onClick={handleSignOut}
          style={{
            width: '100%',
            justifyContent: 'flex-start',
            fontSize: 12,
            height: 34,
            borderRadius: 8,
          }}
        >
          Sign Out
        </Button>
      </div>
    </aside>
  );
};
