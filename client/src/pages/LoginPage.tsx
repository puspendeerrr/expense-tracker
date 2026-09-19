import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth, SessionNotPersistedError } from '@/context/AuthContext';
import { ApiClientError } from '@/lib/api';
import { toast } from 'sonner';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/app';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setIsLoading(true);

    try {
      await login(trimmedEmail, password);
      toast.success('Signed in successfully!', {
        description: 'Welcome back to SplitWise.',
      });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      let msg = 'Unable to sign in. Please try again.';
      if (err instanceof SessionNotPersistedError) {
        // Credentials were fine; the browser refused to keep the cookie. Saying
        // "network error" here would send people looking in entirely the wrong place.
        msg =
          'Your details were correct, but your browser blocked the session cookie. ' +
          'Turn off "Prevent cross-site tracking" in Safari settings, or disable ' +
          'blocking of third-party cookies, then try again.';
      } else if (err instanceof ApiClientError) {
        if (err.code === 'INVALID_CREDENTIALS') {
          msg = 'Invalid email or password.';
        } else if (err.code === 'RATE_LIMITED') {
          msg = err.message || 'Too many sign-in attempts. Please wait a moment.';
        } else {
          msg = err.message || 'Unable to sign in. Please try again.';
        }
      } else {
        msg = 'A network error occurred. Please try again.';
      }
      setErrorMessage(msg);
      toast.error('Sign-in failed', { description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Card className="border-slate-200 shadow-xl shadow-slate-900/5">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            Sign in to your account
          </CardTitle>
          <CardDescription>
            Enter your credentials to manage your shared expenses
          </CardDescription>
        </CardHeader>

        <CardContent>
          {errorMessage && (
            <Alert variant="destructive" className="mb-5">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" required>
                Email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" required>
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline hover:text-emerald-700 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-900 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full mt-2 font-semibold"
              size="lg"
              isLoading={isLoading}
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
              {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center text-sm text-slate-600">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="font-semibold text-primary hover:text-emerald-700 hover:underline transition-colors"
            >
              Create an account
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
};

