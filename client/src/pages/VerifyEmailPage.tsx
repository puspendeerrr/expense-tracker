import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, RefreshCw, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP } from '@/components/ui/input-otp';
import { CountdownTimer } from '@/components/auth/CountdownTimer';
import { useAuth } from '@/context/AuthContext';
import { apiRequest, ApiClientError } from '@/lib/api';
import type { ChallengePayload, User } from '@/types/auth';
import { toast } from 'sonner';

export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();

  const [challenge, setChallenge] = useState<ChallengePayload | null>(() => {
    const fromNav = (location.state as { challenge?: ChallengePayload })?.challenge;
    if (fromNav) return fromNav;
    const stored = sessionStorage.getItem('sw_pending_signup');
    if (stored) {
      try {
        return JSON.parse(stored) as ChallengePayload;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  // If no challenge exists, send user back to signup
  useEffect(() => {
    if (!challenge?.email) {
      navigate('/signup', { replace: true });
    }
  }, [challenge, navigate]);

  // Check if cooldown has already expired initially
  useEffect(() => {
    if (challenge) {
      const target = new Date(challenge.resendAvailableAt).getTime();
      const server = new Date(challenge.serverTime).getTime();
      if (Date.now() + (server - Date.now()) >= target) {
        setCanResend(true);
      } else {
        setCanResend(false);
      }
    }
  }, [challenge]);

  const handleVerify = async (submittedOtp: string) => {
    if (!challenge?.email || submittedOtp.length !== 6 || isVerifying) return;

    setIsVerifying(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await apiRequest<{ user: User }>('/api/auth/signup/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: challenge.email,
          otp: submittedOtp,
        }),
      });

      // Verification succeeded: user was created and session cookie set atomically
      sessionStorage.removeItem('sw_pending_signup');
      setUser(result.user);
      setSuccessMessage('Account verified successfully! Redirecting…');
      toast.success('Account verified successfully!', {
        description: 'Welcome to SplitWise.',
      });

      setTimeout(() => {
        navigate('/app', { replace: true });
      }, 500);
    } catch (err: unknown) {
      let msg = 'Verification failed. Please try again.';
      if (err instanceof ApiClientError) {
        if (err.code === 'OTP_INVALID') {
          const remaining = err.details?.attemptsRemaining;
          setAttemptsRemaining(remaining !== undefined ? remaining : null);
          msg = remaining !== undefined
            ? `Invalid code. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`
            : 'Invalid code. Please check and try again.';
        } else if (err.code === 'OTP_EXPIRED') {
          msg = 'This verification code has expired. Please request a new one.';
        } else if (err.code === 'OTP_MAX_ATTEMPTS') {
          msg = 'Too many incorrect attempts. Please request a new code.';
        } else if (err.code === 'OTP_NOT_FOUND') {
          msg = 'Your signup session has expired. Please start again.';
        } else {
          msg = err.message || 'Verification failed. Please try again.';
        }
      } else {
        msg = 'A network error occurred. Please try again.';
      }
      setErrorMessage(msg);
      toast.error('Verification failed', { description: msg });
      setOtp(''); // Clear slots for retry
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!challenge?.email || isResending || !canResend) return;

    setIsResending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const newChallenge = await apiRequest<ChallengePayload>('/api/auth/signup/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email: challenge.email }),
      });

      setChallenge(newChallenge);
      sessionStorage.setItem('sw_pending_signup', JSON.stringify(newChallenge));
      setCanResend(false);
      setOtp('');
      setAttemptsRemaining(null);
      setSuccessMessage('A new verification code has been sent to your email.');
      toast.info('New verification code sent', {
        description: 'Please check your email for the 6-digit code.',
      });
    } catch (err: unknown) {
      let msg = 'Failed to resend code.';
      if (err instanceof ApiClientError) {
        if (err.code === 'OTP_COOLDOWN') {
          const seconds = err.details?.retryAfterSeconds || 120;
          msg = `Please wait ${seconds}s before requesting another code.`;
          setCanResend(false);
        } else {
          msg = err.message || 'Failed to resend code.';
        }
      } else {
        msg = 'A network error occurred. Please try again.';
      }
      setErrorMessage(msg);
      toast.error('Could not resend', { description: msg });
    } finally {
      setIsResending(false);
    }
  };

  const handleChangeEmail = () => {
    sessionStorage.removeItem('sw_pending_signup');
    navigate('/signup', { replace: true });
  };

  if (!challenge) {
    return null;
  }

  return (
    <AuthLayout>
      <Card className="border-border shadow-xl shadow-slate-900/5">
        <CardHeader className="text-center space-y-1 pb-4">
          <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
            <Mail className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Check your email
          </CardTitle>
          <CardDescription className="text-sm">
            We sent a 6-digit verification code to
            <br />
            <span className="font-semibold text-foreground font-mono text-sm">
              {challenge.maskedEmail}
            </span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert variant="success">
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 pt-1">
            <div className="flex flex-col items-center justify-center space-y-2">
              <InputOTP
                value={otp}
                onChange={setOtp}
                onComplete={handleVerify}
                disabled={isVerifying}
                hasError={Boolean(errorMessage)}
              />

              <div className="text-xs text-muted-foreground pt-2 flex flex-col items-center gap-1">
                <div className="flex items-center gap-1.5">
                  <span>Code expires in</span>
                  <CountdownTimer
                    targetIso={challenge.expiresAt}
                    serverTimeIso={challenge.serverTime}
                    prefix=""
                    suffix="s"
                    className="font-mono font-semibold text-foreground/80"
                    onExpire={() => setErrorMessage('Code expired. Please click resend below.')}
                  />
                </div>
                {attemptsRemaining !== null && (
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    {attemptsRemaining} {attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining before lockout
                  </span>
                )}
              </div>
            </div>

            <Button
              type="button"
              className="w-full font-semibold"
              size="lg"
              disabled={otp.length !== 6 || isVerifying}
              isLoading={isVerifying}
              onClick={() => handleVerify(otp)}
            >
              {isVerifying ? 'Verifying…' : 'Verify & Continue'}
              {!isVerifying && <CheckCircle2 className="ml-2 h-4 w-4" />}
            </Button>
          </div>

          <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={handleChangeEmail}
              className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Change email
            </button>

            <div className="text-right">
              {canResend ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResend}
                  isLoading={isResending}
                  className="text-xs text-primary font-semibold hover:text-emerald-800 dark:text-emerald-300 p-0 h-auto"
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Resend code
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground font-medium">
                  Resend code in{' '}
                  <CountdownTimer
                    targetIso={challenge.resendAvailableAt}
                    serverTimeIso={challenge.serverTime}
                    onExpire={() => setCanResend(true)}
                    className="font-mono font-bold text-muted-foreground"
                  />
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
};
