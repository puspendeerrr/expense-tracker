import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight, KeyRound } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiRequest, ApiClientError } from '@/lib/api';
import type { ChallengePayload } from '@/types/auth';
import { toast } from 'sonner';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const challenge = await apiRequest<ChallengePayload>('/api/auth/password/request-otp', {
        method: 'POST',
        body: JSON.stringify({ email: trimmed }),
      });

      sessionStorage.setItem('sw_pending_reset', JSON.stringify(challenge));
      toast.success('Reset code sent!', {
        description: `Check ${challenge.maskedEmail} for your 6-digit verification code.`,
      });
      navigate('/reset-password', { state: { challenge } });
    } catch (err: unknown) {
      let msg = 'Failed to request password reset.';
      if (err instanceof ApiClientError) {
        if (err.code === 'OTP_COOLDOWN') {
          const seconds = err.details?.retryAfterSeconds || 120;
          msg = `A reset code was already requested. Please wait ${seconds}s before trying again.`;
        } else if (err.code === 'RATE_LIMITED') {
          msg = err.message || 'Too many reset requests. Please wait a moment.';
        } else {
          msg = err.message || 'Failed to request password reset.';
        }
      } else {
        msg = 'A network error occurred. Please try again.';
      }
      setErrorMessage(msg);
      toast.error('Request failed', { description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Card className="border-slate-200 shadow-xl shadow-slate-900/5">
        <CardHeader className="space-y-1">
          <div className="mb-2 h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <KeyRound className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            Reset your password
          </CardTitle>
          <CardDescription>
            Enter your email and we'll send a 6-digit verification code to reset your password
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

            <Button
              type="submit"
              className="w-full mt-2 font-semibold"
              size="lg"
              isLoading={isLoading}
            >
              {isLoading ? 'Sending reset code…' : 'Send verification code'}
              {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
};

