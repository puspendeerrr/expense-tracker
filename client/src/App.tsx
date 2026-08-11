import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider, App as AntdApp, Spin, Button, notification as antdNotification } from 'antd';
import { CloudDownloadOutlined } from '@ant-design/icons';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Navbar } from './components/layout/Navbar';

const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Signup = lazy(() => import('./pages/Signup').then(m => ({ default: m.Signup })));
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const NoGroup = lazy(() => import('./pages/NoGroup').then(m => ({ default: m.NoGroup })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Expenses = lazy(() => import('./pages/Expenses').then(m => ({ default: m.Expenses })));
const Members = lazy(() => import('./pages/Members').then(m => ({ default: m.Members })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const History = lazy(() => import('./pages/History').then(m => ({ default: m.History })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const InspectorDashboard = lazy(() => import('./pages/InspectorDashboard').then(m => ({ default: m.InspectorDashboard })));
const JoinGroupPage = lazy(() => import('./pages/JoinGroupPage').then(m => ({ default: m.JoinGroupPage })));

import { DesktopSidebar } from './components/layout/DesktopSidebar';

import { AIChatButton } from './components/ai/AIChatButton';
import { AIChatDrawer } from './components/ai/AIChatDrawer';
import { notifyAppReady, checkForLiveUpdate, applyLiveUpdate } from './utils/appUpdate';

const PageLoader: React.FC = () => (
  <div
    style={{
      minHeight: '60dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 20,
    }}
  >
    <Spin size="large" />
    <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Loading...</span>
  </div>
);

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, group, isLoading } = useAuth();
  const location = useLocation();
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isSuperAdmin = user?.isSuperAdmin || user?.email === 'admin@gmail.com';
  const isInspector = user?.isInspector || user?.email === 'inspect@gmail.com';

  // Strict Architectural Separation:
  if (isSuperAdmin) {
    if (location.pathname !== '/admin' && location.pathname !== '/profile') {
      return <Navigate to="/admin" replace />;
    }
  } else if (isInspector) {
    if (location.pathname !== '/inspector' && location.pathname !== '/profile') {
      return <Navigate to="/inspector" replace />;
    }
  } else {
    // Normal User Flow:
    if (!group && location.pathname !== '/no-group' && location.pathname !== '/profile') {
      return <Navigate to="/no-group" replace />;
    }
    if (group && location.pathname === '/no-group') {
      return <Navigate to="/dashboard" replace />;
    }
    if (location.pathname === '/admin' || location.pathname === '/inspector') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return (
    <div className="app-shell-layout">
      {/* Left Sider on Desktop */}
      <DesktopSidebar />

      {/* Main Column */}
      <div className="app-main-column">
        <Navbar />
        <main className="app-content-container">
          {children}
        </main>
      </div>

      {/* Floating AI Assistant (for Normal Group Users) */}
      {!isSuperAdmin && group && (
        <>
          <AIChatButton
            onClick={() => setIsAIChatOpen(true)}
            isOpen={isAIChatOpen}
          />
          <AIChatDrawer
            isOpen={isAIChatOpen}
            onClose={() => setIsAIChatOpen(false)}
          />
        </>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  React.useEffect(() => {
    // 1. Confirm bundle boot to CapacitorUpdater (prevents rollback)
    notifyAppReady();

    // 2. Non-blocking background update check
    const performBackgroundCheck = async () => {
      try {
        const result = await checkForLiveUpdate();
        if (result.hasUpdate && result.manifest) {
          const key = `update_notification_${Date.now()}`;
          antdNotification.open({
            key,
            message: 'SplitWise update available',
            description: 'A new version of SplitWise is ready.',
            icon: <CloudDownloadOutlined style={{ color: '#2563eb' }} />,
            duration: 0, // Keep until acted upon
            btn: (
              <Button
                type="primary"
                size="small"
                icon={<CloudDownloadOutlined />}
                onClick={async () => {
                  antdNotification.destroy(key);
                  const success = await applyLiveUpdate(result.manifest!);
                  if (success) {
                    antdNotification.success({
                      message: 'SplitWise Updated',
                      description: 'Restart the app to apply the new version.',
                    });
                  }
                }}
                style={{ backgroundColor: '#2563eb', borderRadius: 8 }}
              >
                Update Now
              </Button>
            ),
          });
        } else if (result.requiresNativeUpdate) {
          antdNotification.warning({
            message: 'SplitWise app update required',
            description: 'A newer Android APK version is available for SplitWise.',
            duration: 8,
          });
        }
      } catch (err) {
        console.warn('[LiveUpdate] Background check error:', err);
      }
    };

    performBackgroundCheck();
  }, []);

  return (
    <ErrorBoundary>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#1677ff',
            borderRadius: 10,
            fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
            fontSize: 14,
            colorText: '#1f2937',
            colorTextHeading: '#111827',
            colorBgContainer: '#ffffff',
            colorBgLayout: '#f8fafc',
            controlHeight: 42,
          },
          components: {
            Button: {
              controlHeight: 42,
              borderRadius: 10,
              fontWeight: 600,
            },
            Input: {
              controlHeight: 42,
              borderRadius: 10,
            },
            Select: {
              controlHeight: 42,
              borderRadius: 10,
            },
            Card: {
              borderRadiusLG: 14,
            },
            Modal: {
              borderRadiusLG: 16,
            },
          },
        }}
      >
        <AntdApp>
          <ToastProvider>
            <AuthProvider>
              <SocketProvider>
                <NotificationProvider>
                  <BrowserRouter
                    future={{
                      v7_startTransition: true,
                      v7_relativeSplatPath: true,
                    }}
                  >
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Public Landing Page & Auth Routes */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/join/:token" element={<JoinGroupPage />} />

                    {/* Protected Routes */}
                    <Route
                      path="/no-group"
                      element={
                        <ProtectedLayout>
                          <NoGroup />
                        </ProtectedLayout>
                      }
                    />
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedLayout>
                          <Dashboard />
                        </ProtectedLayout>
                      }
                    />
                    <Route
                      path="/expenses"
                      element={
                        <ProtectedLayout>
                          <Expenses />
                        </ProtectedLayout>
                      }
                    />
                    <Route
                      path="/members"
                      element={
                        <ProtectedLayout>
                          <Members />
                        </ProtectedLayout>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <ProtectedLayout>
                          <Profile />
                        </ProtectedLayout>
                      }
                    />
                    <Route
                      path="/history"
                      element={
                        <ProtectedLayout>
                          <History />
                        </ProtectedLayout>
                      }
                    />
                    <Route
                      path="/admin"
                      element={
                        <ProtectedLayout>
                          <AdminDashboard />
                        </ProtectedLayout>
                      }
                    />
                    <Route
                      path="/inspector"
                      element={
                        <ProtectedLayout>
                          <InspectorDashboard />
                        </ProtectedLayout>
                      }
                    />
                    <Route
                      path="/settlements"
                      element={
                        <ProtectedLayout>
                          <History />
                        </ProtectedLayout>
                      }
                    />

                    {/* Default Catch-all */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </NotificationProvider>
          </SocketProvider>
            </AuthProvider>
          </ToastProvider>
        </AntdApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
};

export default App;
