import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

/**
 * Gate for the admin console routes.
 *
 * Checks `admin.access` rather than the role, so an administrator can hand someone the
 * console without promoting them. This is UX only -- every endpoint behind these screens
 * enforces the same capability, and the narrower ones on top of it. Someone who edits
 * their way past this component reaches an API that refuses them.
 */
export const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, can } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Checking access…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!can('admin.access')) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
        <ShieldOff className="h-10 w-10 text-muted-foreground/40" />
        <h1 className="mt-4 text-lg font-bold">You do not have access to the admin console</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Console access is granted per account by an administrator.
        </p>
        <a href="/app" className="mt-4 text-sm font-semibold text-primary hover:underline">
          Back to SplitWise
        </a>
      </div>
    );
  }

  return <>{children}</>;
};
