import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { RequireAdmin } from '@/features/admin/RequireAdmin';
import { AdminOverview } from '@/features/admin/pages/AdminOverview';
import { AdminUsers } from '@/features/admin/pages/AdminUsers';
import { AdminUserDetail } from '@/features/admin/pages/AdminUserDetail';
import { AdminGroups } from '@/features/admin/pages/AdminGroups';
import { AdminGroupDetail } from '@/features/admin/pages/AdminGroupDetail';
import { AdminExpenses } from '@/features/admin/pages/AdminExpenses';
import { AdminSettlements } from '@/features/admin/pages/AdminSettlements';
import { AdminActivity } from '@/features/admin/pages/AdminActivity';
import { AdminPermissions } from '@/features/admin/pages/AdminPermissions';
import { AdminReports } from '@/features/admin/pages/AdminReports';
import { AdminAudit } from '@/features/admin/pages/AdminAudit';
import { GroupProvider } from '@/context/GroupContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PublicOnlyRoute } from '@/components/PublicOnlyRoute';

import { LoginPage } from '@/pages/LoginPage';
import { SignupPage } from '@/pages/SignupPage';
import { VerifyEmailPage } from '@/pages/VerifyEmailPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { MembersPage } from '@/features/members/MembersPage';
import { SettlementsPage } from '@/features/settlements/SettlementsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { ActivityPage } from '@/features/activity/ActivityPage';
import { SpendingPage } from '@/features/insights/SpendingPage';
import {
  CreateGroupPage,
  GroupsPage,
  JoinGroupPage,
} from '@/features/groups/GroupPages';
import { ProfilePage } from '@/pages/ProfilePage';
import { SecurityPage } from '@/pages/SecurityPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { LandingPage } from '@/pages/LandingPage';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'react-router-dom';
import { AiChatProvider } from '@/hooks/useAiChat';
import { AiChatButton } from '@/components/ai/AiChatButton';
import { AiChatPanel } from '@/components/ai/AiChatPanel';

const AuthenticatedAssistant: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !location.pathname.startsWith('/app')) {
    return null;
  }

  return (
    <>
      <AiChatButton />
      <AiChatPanel />
    </>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
    <AuthProvider>
      <Toaster />
      <GroupProvider>
        <AiChatProvider>
          <BrowserRouter>
          <AuthenticatedAssistant />
          <Routes>
          {/* Public-only authentication routes */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute>
                <SignupPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/verify-email"
            element={
              <PublicOnlyRoute>
                <VerifyEmailPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicOnlyRoute>
                <ForgotPasswordPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/reset-password"
            element={
              <PublicOnlyRoute>
                <ResetPasswordPage />
              </PublicOnlyRoute>
            }
          />

          {/* Protected routes */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/expenses"
            element={
              <ProtectedRoute>
                <ExpensesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/members"
            element={
              <ProtectedRoute>
                <MembersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/settlements"
            element={
              <ProtectedRoute>
                <SettlementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/activity"
            element={
              <ProtectedRoute>
                <ActivityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/spending"
            element={
              <ProtectedRoute>
                <SpendingPage />
              </ProtectedRoute>
            }
          />
          {/* The admin console moved out of the user shell; keep old links working. */}
          <Route path="/app/admin" element={<Navigate to="/admin" replace />} />
          <Route
            path="/app/groups"
            element={
              <ProtectedRoute>
                <GroupsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/groups/new"
            element={
              <ProtectedRoute>
                <CreateGroupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/groups/join"
            element={
              <ProtectedRoute>
                <JoinGroupPage />
              </ProtectedRoute>
            }
          />
          {/* Shared invite links land here; the page previews before asking to join. */}
          <Route
            path="/join/:token"
            element={
              <ProtectedRoute>
                <JoinGroupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/security"
            element={
              <ProtectedRoute>
                <SecurityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Landing page */}
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminOverview />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireAdmin>
                <AdminUsers />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/users/:id"
            element={
              <RequireAdmin>
                <AdminUserDetail />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/groups"
            element={
              <RequireAdmin>
                <AdminGroups />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/groups/:id"
            element={
              <RequireAdmin>
                <AdminGroupDetail />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/expenses"
            element={
              <RequireAdmin>
                <AdminExpenses />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/settlements"
            element={
              <RequireAdmin>
                <AdminSettlements />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/activity"
            element={
              <RequireAdmin>
                <AdminActivity />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/permissions"
            element={
              <RequireAdmin>
                <AdminPermissions />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <RequireAdmin>
                <AdminReports />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <RequireAdmin>
                <AdminAudit />
              </RequireAdmin>
            }
          />

          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
        </AiChatProvider>
      </GroupProvider>
    </AuthProvider>
    </ThemeProvider>
  );
};

export default App;

