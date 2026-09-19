import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Lock, RefreshCw, ArrowLeft, CheckCircle2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP } from '@/components/ui/input-otp';
import { CountdownTimer } from '@/components/auth/CountdownTimer';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { apiRequest, ApiClientError } from '@/lib/api';
import type { ChallengePayload, ResetAuthorizationPayload } from '@/types/auth';
import { toast } from 'sonner';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [challenge, setChallenge] = useState<ChallengePayload | null>(() => {
    const fromNav = (location.state as { challenge?: ChallengePayload })?.challenge;
    if (fromNav) return fromNav;
    const stored = sessionStorage.getItem('sw_pending_reset');
    if (stored) {
      try {
        return JSON.parse(stored) as ChallengePayload;
      } catch {
        return null;
      }
    }
    return null;
  });

  // Step state: 'otp' | 'new_password' | 'done'
  const [step, setStep] = useState<'otp' | 'new_password' | 'done'>('otp');
  const [resetToken, setResetToken] = useState<string | null>(null);

  // OTP inputs
  const [otp, setOtp] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [canResend, setCanResend] = useState(false);

  // Password inputs
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Guard: if accessed directly without a pending reset challenge, navigate to /forgot-password
  useEffect(() => {
    if (!challenge?.email && step === 'otp') {
      navigate('/forgot-password', { replace: true });
    }
  }, [challenge, step, navigate]);

  // Check initial cooldown status
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

  const handleVerifyOtp = async (submittedOtp: string) => {
    if (!challenge?.email || submittedOtp.length !== 6 || isVerifyingOtp) return;

    setIsVerifyingOtp(true);
    setErrorMessage(null);

    try {
      const result = await apiRequest<ResetAuthorizationPayload>('/api/auth/password/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: challenge.email,
          otp: submittedOtp,
        }),
      });

      setResetToken(result.resetToken);
      setStep('new_password');
      setSuccessMessage('Code verified! Please choose a new password.');
      toast.success('Code verified!', {
        description: 'Please enter your new password.',
      });
    } catch (err: unknown) {
      let msg = 'Verification failed. Please try again.';
      if (err instanceof ApiClientError) {
        if (err.code === 'OTP_INVALID') {
          const remaining = err.details?.attemptsRemaining;
          msg = remaining !== undefined
            ? `Invalid code. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`
            : 'Invalid code. Please check and try again.';
        } else if (err.code === 'OTP_EXPIRED') {
          msg = 'This reset code has expired. Please request a new one.';
        } else if (err.code === 'OTP_MAX_ATTEMPTS') {
          msg = 'Too many incorrect attempts. Please request a new code.';
        } else {
          msg = err.message || 'Verification failed. Please try again.';
        }
      } else {
        msg = 'A network error occurred. Please try again.';
      }
      setErrorMessage(msg);
      toast.error('Verification failed', { description: msg });
      setOtp('');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!challenge?.email || isResending || !canResend) return;

    setIsResending(true);
    setErrorMessage(null);

    try {
      const newChallenge = await apiRequest<ChallengePayload>('/api/auth/password/request-otp', {
        method: 'POST',
        body: JSON.stringify({ email: challenge.email }),
      });

      setChallenge(newChallenge);
      sessionStorage.setItem('sw_pending_reset', JSON.stringify(newChallenge));
      setCanResend(false);
      setOtp('');
      setSuccessMessage('A new reset code was dispatched.');
      toast.info('New reset code sent', {
        description: 'Please check your email for the new 6-digit code.',
      });
    } catch (err: unknown) {
      let msg = 'Failed to resend reset code.';
      if (err instanceof ApiClientError) {
        if (err.code === 'OTP_COOLDOWN') {
          const seconds = err.details?.retryAfterSeconds || 120;
          msg = `Please wait ${seconds}s before requesting another code.`;
          setCanResend(false);
        } else {
          msg = err.message || 'Failed to resend reset code.';
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMessage('Password must include uppercase, lowercase, and a number.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsResetting(true);

    try {
      await apiRequest('/api/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({
          resetToken,
          password,
          confirmPassword,
        }),
      });

      sessionStorage.removeItem('sw_pending_reset');
      setStep('done');
      toast.success('Password updated successfully!', {
        description: 'You can now sign in with your new password.',
      });
    } catch (err: unknown) {
      let msg = 'Failed to reset password.';
      if (err instanceof ApiClientError) {
        if (err.code === 'RESET_TOKEN_EXPIRED') {
          msg = 'Your reset session expired. Please start over.';
        } else if (err.code === 'RESET_TOKEN_INVALID') {
          msg = 'This reset session is no longer valid. Please start over.';
        } else {
          msg = err.message || 'Failed to reset password.';
        }
      } else {
        msg = 'A network error occurred. Please try again.';
      }
      setErrorMessage(msg);
      toast.error('Password reset failed', { description: msg });
    } finally {
      setIsResetting(false);
    }
  };

  if (step === 'done') {
    return (
      <AuthLayout>
        <Card className="border-border shadow-xl shadow-slate-900/5 text-center">
          <CardHeader className="space-y-2 pb-4">
            <div className="mx-auto mb-2 h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Password updated!
            </CardTitle>
            <CardDescription>
              Your password has been changed securely. All existing sessions have been terminated.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Button
              className="w-full font-semibold"
              size="lg"
              onClick={() => navigate('/login', { replace: true })}
            >
              Sign in with new password
            </Button>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Card className="border-border shadow-xl shadow-slate-900/5">
        <CardHeader className="space-y-1 pb-4">
          <div className="mb-2 h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            {step === 'otp' ? 'Enter reset code' : 'Choose a new password'}
          </CardTitle>
          <CardDescription>
            {step === 'otp' ? (
              <>
                Enter the 6-digit code sent to{' '}
                <span className="font-semibold text-foreground font-mono">
                  {challenge?.maskedEmail}
                </span>
              </>
            ) : (
              'Set a strong password that you do not use on other websites'
            )}
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

          {step === 'otp' ? (
            <div className="space-y-4 pt-1">
              <div className="flex flex-col items-center justify-center space-y-2">
                <InputOTP
                  value={otp}
                  onChange={setOtp}
                  onComplete={handleVerifyOtp}
                  disabled={isVerifyingOtp}
                  hasError={Boolean(errorMessage)}
                />

                {challenge && (
                  <div className="text-xs text-muted-foreground pt-2 flex items-center gap-1.5">
                    <span>Code expires in</span>
                    <CountdownTimer
                      targetIso={challenge.expiresAt}
                      serverTimeIso={challenge.serverTime}
                      className="font-mono font-semibold text-foreground/80"
                      onExpire={() => setErrorMessage('Code expired. Please click resend.')}
                    />
                  </div>
                )}
              </div>

              <Button
                type="button"
                className="w-full font-semibold"
                size="lg"
                disabled={otp.length !== 6 || isVerifyingOtp}
                isLoading={isVerifyingOtp}
                onClick={() => handleVerifyOtp(otp)}
              >
                {isVerifyingOtp ? 'Verifying code…' : 'Verify code'}
              </Button>

              <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                <Link
                  to="/forgot-password"
                  className="text-muted-foreground hover:text-foreground font-medium transition-colors"
                >
                  <ArrowLeft className="inline mr-1 h-3.5 w-3.5" />
                  Try different email
                </Link>

                <div>
                  {canResend ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResendOtp}
                      isLoading={isResending}
                      className="text-xs text-primary font-semibold hover:text-emerald-800 dark:text-emerald-300 p-0 h-auto"
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Resend code
                    </Button>
                  ) : (
                    challenge && (
                      <span className="text-muted-foreground font-medium">
                        Resend in{' '}
                        <CountdownTimer
                          targetIso={challenge.resendAvailableAt}
                          serverTimeIso={challenge.serverTime}
                          onExpire={() => setCanResend(true)}
                          className="font-mono font-bold text-muted-foreground"
                        />
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" required>
                  New password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    autoFocus
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={isResetting}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrengthIndicator password={password} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmNewPassword" required>
                  Confirm new password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmNewPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    disabled={isResetting}
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-muted border border-border/80 rounded-xl text-xs text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>Resetting will automatically sign out all active sessions on other devices.</span>
              </div>

              <Button
                type="submit"
                className="w-full font-semibold"
                size="lg"
                isLoading={isResetting}
              >
                {isResetting ? 'Updating password…' : 'Update password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
};

