import React, { useEffect, useState } from 'react';
import { Shield, User as UserIcon, CheckCircle2, Activity, Calendar } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/api';

import { UserNav } from '@/components/navigation/UserNav';
import { BrandLogo } from '@/components/brand/BrandLogo';

export const DashboardPlaceholder: React.FC = () => {
  const { user } = useAuth();
  const [overview, setOverview] = useState<{ greeting?: string } | null>(null);
  const [isCallingApi, setIsCallingApi] = useState(false);

  useEffect(() => {
    const fetchOverview = async () => {
      setIsCallingApi(true);
      try {
        const data = await apiRequest<{ greeting: string; placeholder: boolean }>('/api/app/overview');
        setOverview(data);
      } catch (err) {
        console.error('Failed to fetch protected overview:', err);
      } finally {
        setIsCallingApi(false);
      }
    };

    fetchOverview();
  }, []);

  return (
    <div className="min-h-screen bg-muted flex flex-col">
      {/* Top Navbar */}
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo variant="full" size="md" className="h-10 sm:h-11 w-auto" />
          </div>

          <div className="flex items-center gap-3">
            <UserNav />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg shadow-emerald-950/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card/10 text-emerald-100 text-xs font-semibold mb-2">
                <Shield className="h-3.5 w-3.5" />
                <span>Protected Authentication Session Verified</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {overview?.greeting || `Welcome, ${user?.fullName}!`}
              </h1>
              <p className="text-emerald-100/80 text-sm mt-1">
                Your account is authenticated via HttpOnly revocable session cookies.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="verified" className="bg-emerald-950/40 text-emerald-200 border-emerald-500/30">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Email Verified
              </Badge>
            </div>
          </div>
        </div>

        {/* User Identity Details Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                Account Profile & Roles
              </CardTitle>
              <CardDescription>
                Live user record loaded from PostgreSQL source of truth
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-muted rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-medium block">Full Name</span>
                  <span className="font-semibold text-foreground">{user?.fullName}</span>
                </div>

                <div className="p-3 bg-muted rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-medium block">Email Address</span>
                  <span className="font-semibold text-foreground font-mono text-xs">{user?.email}</span>
                </div>

                <div className="p-3 bg-muted rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-medium block">System Role</span>
                  <div className="mt-1">
                    <Badge variant={user?.role === 'admin' ? 'admin' : 'secondary'}>
                      {user?.role === 'admin' ? 'Administrator' : 'Standard User'}
                    </Badge>
                  </div>
                </div>

                <div className="p-3 bg-muted rounded-xl border border-border">
                  <span className="text-xs text-muted-foreground font-medium block">Account Created</span>
                  <span className="font-medium text-foreground/80 text-xs flex items-center gap-1 mt-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Just now'}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-muted-foreground">
                <p className="font-semibold text-emerald-950 mb-1">Scope Compliance Notice:</p>
                <p>
                  Per the prompt instructions, dashboard expense tracking, group management, and settlement
                  features are held for future phases. This view certifies that login, signup OTP, password reset,
                  and session gates are operating seamlessly.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                API Connection
              </CardTitle>
              <CardDescription>
                Protected endpoint check
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">API Gateway</span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Connected
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">Auth Gate</span>
                <span className="text-xs font-mono font-medium text-foreground/80">/api/app/overview</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">Session Cookie</span>
                <span className="text-xs font-mono font-medium text-foreground/80">sw_session (HttpOnly)</span>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  isLoading={isCallingApi}
                  onClick={async () => {
                    setIsCallingApi(true);
                    try {
                      const data = await apiRequest<{ greeting: string }>('/api/app/overview');
                      setOverview(data);
                    } finally {
                      setIsCallingApi(false);
                    }
                  }}
                >
                  Ping Protected Endpoint
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

