import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, User as UserIcon, ArrowRight } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { apiRequest, ApiClientError } from '@/lib/api';
import type { ChallengePayload } from '@/types/auth';
import { toast } from 'sonner';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateClient = (): boolean => {
    const errors: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.';
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    } else if (!/[a-z]/.test(password)) {
      errors.password = 'Password must include at least one lowercase letter.';
    } else if (!/[A-Z]/.test(password)) {
      errors.password = 'Password must include at least one uppercase letter.';
    } else if (!/[0-9]/.test(password)) {
      errors.password = 'Password must include at least one number.';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    if (!validateClient()) {
      return;
    }

    setIsLoading(true);

    try {
      const challenge = await apiRequest<ChallengePayload>('/api/auth/signup/request-otp', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          confirmPassword,
        }),
      });

      // Save challenge in sessionStorage so /verify-email can resume seamlessly
      sessionStorage.setItem('sw_pending_signup', JSON.stringify(challenge));

      toast.success('Verification code sent!', {
        description: `We sent a 6-digit code to ${challenge.maskedEmail}`,
      });

      navigate('/verify-email', { state: { challenge } });
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.code === 'EMAIL_ALREADY_EXISTS') {
          setFieldErrors({ email: 'An account with this email already exists.' });
          toast.error('Account already exists', {
            description: 'An account with this email already exists. Try signing in.',
          });
        } else if (err.code === 'EMAIL_DELIVERY_FAILED') {
          const msg = 'We could not send the verification email. Please check the address or try again in a moment.';
          setGeneralError(msg);
          toast.error('Delivery failed', { description: msg });
        } else if (err.fields) {
          const map: Record<string, string> = {};
          err.fields.forEach((f) => {
            map[f.field] = f.message;
          });
          setFieldErrors(map);
          toast.error('Validation error', { description: 'Please correct the highlighted fields.' });
        } else {
          const msg = err.message || 'Failed to create account.';
          setGeneralError(msg);
          toast.error('Signup failed', { description: msg });
        }
      } else {
        const msg = 'A network error occurred. Please try again.';
        setGeneralError(msg);
        toast.error('Network error', { description: msg });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Card className="border border-white/[0.08] bg-[#18181B]/95 backdrop-blur-xl shadow-2xl shadow-black/60">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            Create an account
          </CardTitle>
          <CardDescription className="text-slate-400">
            Join SplitMoney to split bills and track balances with flatmates
          </CardDescription>
        </CardHeader>

        <CardContent>
          {generalError && (
            <Alert variant="destructive" className="mb-5 bg-red-950/30 border border-red-500/20 text-red-300">
              <AlertDescription>{generalError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="fullName" required className="text-slate-200">
                Full name
              </Label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Jonathan Ive"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                  hasError={Boolean(fieldErrors.fullName)}
                  required
                />
              </div>
              {fieldErrors.fullName && (
                <p className="text-xs text-red-400 mt-1 font-medium">{fieldErrors.fullName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" required className="text-slate-200">
                Email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                  hasError={Boolean(fieldErrors.email)}
                  required
                />
              </div>
              {fieldErrors.email && (
                <p className="text-xs text-red-400 mt-1 font-medium">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" required className="text-slate-200">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={isLoading}
                  hasError={Boolean(fieldErrors.password)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white focus:outline-none transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-slate-400" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-red-400 mt-1 font-medium">{fieldErrors.password}</p>
              )}
              <PasswordStrengthIndicator password={password} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" required className="text-slate-200">
                Confirm password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  disabled={isLoading}
                  hasError={Boolean(fieldErrors.confirmPassword)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white focus:outline-none transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-slate-400" />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-xs text-red-400 mt-1 font-medium">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full mt-2 font-semibold shadow-lg shadow-emerald-950/40"
              size="lg"
              isLoading={isLoading}
            >
              {isLoading ? 'Sending verification code…' : 'Continue to verification'}
              {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/[0.08] text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
            >
              Sign in instead
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
};

