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
const NoGroup = lazy(() => import('./pages/NoGroup').then(m => ({ default: m.NoGroup })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Expenses = lazy(() => import('./pages/Expenses').then(m => ({ default: m.Expenses })));
const Members = lazy(() => import('./pages/Members').then(m => ({ default: m.Members })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const History = lazy(() => import('./pages/History').then(m => ({ default: m.History })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const InspectorDashboard = lazy(() => import('./pages/InspectorDashboard').then(m => ({ default: m.InspectorDashboard })));
const JoinGroupPage = lazy(() => import('./pages/JoinGroupPage').then(m => ({ default: m.JoinGroupPage })));
const FounderNote = lazy(() => import('./pages/FounderNote').then(m => ({ default: m.FounderNote })));
const DeveloperJournal = lazy(() => import('./pages/DeveloperJournal').then(m => ({ default: m.DeveloperJournal })));

import { DesktopSidebar } from './components/layout/DesktopSidebar';

import { AIChatButton } from './components/ai/AIChatButton';
import { AIChatDrawer } from './components/ai/AIChatDrawer';
import { notifyAppReady, checkForLiveUpdate, applyLiveUpdate } from './utils/appUpdate';

const ScrollToTop: React.FC = () => {
  const { pathname, hash } = useLocation();

  React.useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      const appContent = document.querySelector('.app-content-container');
      if (appContent) {
        appContent.scrollTop = 0;
      }
    }
  }, [pathname, hash]);

  return null;
};

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
          <AIChatButton onClick={() => setIsAIChatOpen(true)} isOpen={isAIChatOpen} />
          <AIChatDrawer isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} />
        </>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  React.useEffect(() => {
    // 1. Confirm bundle boot to CapacitorUpdater (prevents rollback)
    notifyAppReady();
    // 2. Automated background live update check & seamless application
    const performBackgroundCheck = async () => {
      try {
        const result = await checkForLiveUpdate();
        if (result.hasUpdate && result.manifest) {
          const key = `update_auto_${Date.now()}`;
          antdNotification.info({
            key,
            message: 'Updating SplitWise automatically...',
            description: `Downloading & applying latest update (v${result.manifest.version}).`,
            icon: <CloudDownloadOutlined style={{ color: '#2563eb' }} />,
            duration: 4,
          });

          const success = await applyLiveUpdate(result.manifest);
          if (success) {
            antdNotification.success({
              message: 'SplitWise Updated Automatically',
              description: 'The app bundle has been updated to the latest version.',
              duration: 6,
            });
          }
        } else if (result.requiresNativeUpdate) {
          antdNotification.warning({
            message: 'SplitWise App Update Available',
            description: 'A newer Android APK version (v2.0.0) is available.',
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
                    <ScrollToTop />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Public Auth & Info Routes */}
                    <Route path="/founder" element={<FounderNote />} />
                    <Route path="/developer" element={<DeveloperJournal />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/join/:token" element={<JoinGroupPage />} />

                    {/* Protected Routes & Root App Route */}
                    <Route
                      path="/"
                      element={
                        <ProtectedLayout>
                          <Dashboard />
                        </ProtectedLayout>
                      }
                    />
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
