import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  ChevronRight,
  User as UserIcon,
  Shield,
  Calendar,
  CreditCard,
  QrCode,
  Upload,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  Trash2,
  Crop,
  Maximize2,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { UserNav } from '@/components/navigation/UserNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { QRImageCropperModal } from '@/components/profile/QRImageCropperModal';
import { apiRequest, ApiClientError } from '@/lib/api';
import { toast } from 'sonner';

export const ProfilePage: React.FC = () => {
  const { user, setUser, refreshUser } = useAuth();

  // Personal Info Form
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [isSavingName, setIsSavingName] = useState(false);

  // UPI & QR Code Form
  const [upiId, setUpiId] = useState(user?.upiId || '');
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(user?.qrCodeUrl || null);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // QR Cropper Modal State
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperSource, setCropperSource] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fullscreen QR Modal State
  const [previewFullQR, setPreviewFullQR] = useState(false);

  // Change Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // UPI Validation helper
  const isUpiValid = !upiId || /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId.trim());

  // 1. Update Personal Info (Full Name)
  const handleSavePersonalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = fullName.trim();
    if (trimmed.length < 2) {
      toast.error('Name must be at least 2 characters long');
      return;
    }

    setIsSavingName(true);
    try {
      const data = await apiRequest<{ user: typeof user }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ fullName: trimmed }),
      });
      if (data?.user) {
        setUser(data.user);
      } else {
        await refreshUser();
      }
      toast.success('Personal details updated successfully');
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to update name.';
      toast.error(msg);
    } finally {
      setIsSavingName(false);
    }
  };

  // 2. Handle File Selection for QR
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, JPEG, WEBP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image size must be under 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCropperSource(result);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  // 3. Save Payment Settings (UPI ID & QR Code)
  const handleSavePaymentSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (upiId && !isUpiValid) {
      toast.error('Please enter a valid UPI ID (e.g. username@bank).');
      return;
    }

    setIsSavingPayment(true);
    try {
      const data = await apiRequest<{ user: typeof user }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          upiId: upiId.trim() || '',
          qrCodeUrl: qrCodeUrl || '',
        }),
      });
      if (data?.user) {
        setUser(data.user);
      } else {
        await refreshUser();
      }
      toast.success('Payment credentials updated successfully');
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to save payment info.';
      toast.error(msg);
    } finally {
      setIsSavingPayment(false);
    }
  };

  // 4. Remove QR Code
  const handleRemoveQR = () => {
    setQrCodeUrl(null);
    toast.info('QR Code removed from draft. Click "Save Payment Details" to apply.');
  };

  // 5. Update Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await apiRequest('/api/auth/profile/password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      toast.success('Password updated successfully', {
        description: 'Your account is now secured with your new password.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to change password.';
      toast.error(msg);
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-muted flex flex-col">
      {/* Top Navbar */}
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/app" className="flex items-center gap-3 group">
              <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm shadow-emerald-700/20 group-hover:scale-105 transition-transform">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-extrabold tracking-tight text-foreground">SplitWise</span>
                <span className="text-[9px] uppercase font-bold tracking-widest text-emerald-700 dark:text-emerald-400 -mt-1">
                  Workspace
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <UserNav />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Link to="/app" className="hover:text-emerald-700 dark:text-emerald-400 transition-colors">
            Workspace
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-foreground font-semibold">Account Profile</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/80">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Account Profile
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your personal identity, payment settlement information, and security credentials.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge variant={user.role === 'admin' ? 'admin' : 'secondary'} className="py-1 px-2.5">
              <Shield className="h-3.5 w-3.5 mr-1" />
              {user.role === 'admin' ? 'Administrator' : 'Standard User'}
            </Badge>
          </div>
        </div>

        {/* Grid Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CARD 1: Personal Details */}
          <Card className="shadow-sm border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                Personal Details
              </CardTitle>
              <CardDescription>Your public identity across your SplitWise groups</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePersonalInfo} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-semibold text-foreground/80">
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your Full Name"
                    className="h-10"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80">Email Address</Label>
                  <div className="relative">
                    <Input
                      value={user.email}
                      readOnly
                      disabled
                      className="h-10 bg-muted font-mono text-xs text-muted-foreground cursor-not-allowed pr-28"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <Badge variant="verified" className="text-[10px] py-0.5 px-2">
                        <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                        Verified
                      </Badge>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Your email address is the primary identifier used for authentication and group invites.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-muted rounded-xl border border-border">
                    <span className="text-[11px] text-muted-foreground font-medium block">Account Role</span>
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider mt-0.5 block">
                      {user.role}
                    </span>
                  </div>
                  <div className="p-3 bg-muted rounded-xl border border-border">
                    <span className="text-[11px] text-muted-foreground font-medium block">Member Since</span>
                    <span className="text-xs font-medium text-foreground mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={isSavingName}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* CARD 2: UPI & Payment QR Code */}
          <Card className="shadow-sm border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                Payment & UPI Settings
              </CardTitle>
              <CardDescription>
                Roommates and group members can scan your QR or use your UPI ID to settle balances
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePaymentSettings} className="space-y-4">
                {/* UPI ID */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="upiId" className="text-xs font-semibold text-foreground/80">
                      UPI ID (VPA)
                    </Label>
                    {upiId && (
                      <span
                        className={`text-[10px] font-semibold ${
                          isUpiValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                        }`}
                      >
                        {isUpiValid ? 'Valid UPI ID' : 'Invalid format'}
                      </span>
                    )}
                  </div>
                  <Input
                    id="upiId"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. yourname@okhdfcbank"
                    className="h-10 font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Format: username@bank (e.g. john@oksbi, alex@paytm).
                  </p>
                </div>

                {/* QR Code Upload / Manager */}
                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
                    <span>Payment QR Code</span>
                    {qrCodeUrl && (
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        Active QR Attached
                      </span>
                    )}
                  </Label>

                  {qrCodeUrl ? (
                    <div className="p-4 bg-muted border border-border rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                      {/* QR Thumbnail */}
                      <div className="relative group/qr flex-shrink-0">
                        <img
                          src={qrCodeUrl}
                          alt="Payment QR Code"
                          className="h-28 w-28 rounded-xl object-contain bg-card border border-border shadow-sm p-1.5"
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewFullQR(true)}
                          className="absolute inset-0 bg-slate-950/40 rounded-xl flex items-center justify-center text-white opacity-0 group-hover/qr:opacity-100 transition-opacity"
                          title="View Fullsize"
                        >
                          <Maximize2 className="h-5 w-5" />
                        </button>
                      </div>

                      {/* QR Actions */}
                      <div className="flex-1 space-y-2 w-full text-center sm:text-left">
                        <p className="text-xs font-semibold text-foreground">
                          Custom Payment QR Code
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Square cropped and formatted for high-contrast mobile scanning.
                        </p>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCropperSource(qrCodeUrl);
                              setCropperOpen(true);
                            }}
                            className="h-8 text-xs gap-1.5"
                          >
                            <Crop className="h-3.5 w-3.5 text-muted-foreground" />
                            Re-crop
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-8 text-xs gap-1.5"
                          >
                            <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                            Replace
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveQR}
                            className="h-8 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:text-red-400 hover:bg-red-500/10 gap-1.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Dropzone when no QR code uploaded */
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files?.[0]) {
                          handleFileSelect(e.dataTransfer.files[0]);
                        }
                      }}
                      className="border-2 border-dashed border-border hover:border-emerald-600 hover:bg-emerald-500/10 rounded-2xl p-6 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center group"
                    >
                      <div className="h-11 w-11 rounded-2xl bg-muted group-hover:bg-emerald-500/15 flex items-center justify-center text-muted-foreground group-hover:text-emerald-700 dark:text-emerald-400 transition-colors mb-2">
                        <QrCode className="h-6 w-6" />
                      </div>
                      <p className="text-xs font-bold text-foreground">
                        Upload Payment QR Code
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Drag & drop or click to browse (PNG, JPG, WEBP up to 8MB)
                      </p>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mt-2 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                        Includes interactive square crop editor
                      </p>
                    </div>
                  )}

                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFileSelect(e.target.files[0]);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={isSavingPayment}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white"
                  >
                    Save Payment Details
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* CARD 3: Change Password */}
          <Card className="lg:col-span-2 shadow-sm border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                Change Password
              </CardTitle>
              <CardDescription>
                Keep your account protected with a strong, secure passphrase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-2xl">
                {/* Current Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="currentPassword" className="text-xs font-semibold text-foreground/80">
                    Current Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="h-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* New & Confirm Password Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* New Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword" className="text-xs font-semibold text-foreground/80">
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="h-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs font-semibold text-foreground/80">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="h-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Mismatch Warning */}
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                    New passwords do not match.
                  </p>
                )}

                {/* Password Strength Indicator */}
                {newPassword && (
                  <PasswordStrengthIndicator password={newPassword} className="pt-1" />
                )}

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={isSavingPassword}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white"
                  >
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* QR Cropper Modal */}
      <QRImageCropperModal
        isOpen={cropperOpen}
        imageSrc={cropperSource}
        onClose={() => {
          setCropperOpen(false);
          setCropperSource(null);
        }}
        onApply={(dataUrl) => {
          setQrCodeUrl(dataUrl);
          toast.success('QR Code cropped! Click "Save Payment Details" to apply.');
        }}
      />

      {/* Fullscreen QR Preview Modal */}
      {previewFullQR && qrCodeUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in-0">
          <div className="bg-card rounded-3xl p-6 max-w-sm w-full flex flex-col items-center gap-4 relative shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewFullQR(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-muted hover:bg-accent text-muted-foreground flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="text-center pt-2">
              <h3 className="font-bold text-foreground text-base">{user.fullName}</h3>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{upiId || user.email}</p>
            </div>
            <div className="p-3 bg-muted border border-border rounded-2xl shadow-inner">
              <img
                src={qrCodeUrl}
                alt="Fullsize Payment QR"
                className="w-64 h-64 object-contain rounded-xl bg-card p-2"
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Scan with any UPI app (Google Pay, PhonePe, Paytm, BHIM)
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
