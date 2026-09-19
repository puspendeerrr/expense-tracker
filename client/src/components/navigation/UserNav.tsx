import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  User as UserIcon,
  Settings,
  LogOut,
  Sparkles,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UserNavProps {
  className?: string;
}

export const UserNav: React.FC<UserNavProps> = ({ className }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Dropdown states
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Logout confirmation state
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Notification read state
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
        setConfirmLogout(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileOpen(false);
        setNotificationsOpen(false);
        setConfirmLogout(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleFinalLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success('Logged out successfully', {
        description: 'You have been signed out of your account.',
      });
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error('Failed to log out. Please try again.');
    } finally {
      setIsLoggingOut(false);
      setProfileOpen(false);
      setConfirmLogout(false);
    }
  };

  const handleMarkAllNotificationsRead = () => {
    setHasUnreadNotifications(false);
    toast.success('All notifications marked as read');
  };

  if (!user) return null;

  return (
    <div className={cn('flex items-center gap-2.5 sm:gap-3', className)}>
      {/* 1. NOTIFICATION BELL */}
      <div className="relative" ref={notificationsRef}>
        <button
          type="button"
          onClick={() => {
            setNotificationsOpen((prev) => !prev);
            setProfileOpen(false);
            setConfirmLogout(false);
          }}
          className={cn(
            'relative h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-150 outline-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary',
            notificationsOpen
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm'
              : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 hover:text-slate-950 border border-transparent',
          )}
          aria-label="View notifications"
          aria-expanded={notificationsOpen}
        >
          <Bell className="h-5 w-5" />
          {hasUnreadNotifications && (
            <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
          )}
        </button>

        {/* Notification Dropdown Panel */}
        {notificationsOpen && (
          <div className="absolute right-0 mt-2 w-80 sm:w-88 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-3 z-50 animate-in fade-in-0 zoom-in-95 origin-top-right">
            <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">Notifications</span>
                {hasUnreadNotifications && (
                  <Badge variant="verified" className="text-[10px] py-0 px-1.5">
                    1 New
                  </Badge>
                )}
              </div>
              {hasUnreadNotifications && (
                <button
                  type="button"
                  onClick={handleMarkAllNotificationsRead}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-medium hover:underline"
                >
                  Mark read
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto px-2 py-2 space-y-1">
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    Welcome to SplitWise!
                  </span>
                  <span className="text-[10px] text-slate-400">Just now</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your account is verified. You can split expenses, invite roommates, and settle balances seamlessly.
                </p>
              </div>

              <div className="p-3 rounded-xl hover:bg-slate-50 transition-colors space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
                    Security Check Passed
                  </span>
                  <span className="text-[10px] text-slate-400">Today</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Session authenticated securely with 256-bit encryption.
                </p>
              </div>
            </div>

            <div className="px-4 pt-2 border-t border-slate-100 text-center">
              <span className="text-[11px] text-slate-400">
                You're all caught up on notifications
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. PERSON ICON / USER AVATAR BUTTON */}
      <div className="relative" ref={profileRef}>
        <button
          type="button"
          onClick={() => {
            setProfileOpen((prev) => !prev);
            setNotificationsOpen(false);
            setConfirmLogout(false);
          }}
          className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-150 outline-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary',
            profileOpen
              ? 'bg-emerald-800 text-white shadow-md shadow-emerald-800/25 ring-2 ring-emerald-600/30'
              : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm shadow-emerald-700/20',
          )}
          aria-label="User account menu"
          aria-expanded={profileOpen}
        >
          <UserIcon className="h-5 w-5" />
        </button>

        {/* Profile Dropdown Menu */}
        {profileOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 z-50 animate-in fade-in-0 zoom-in-95 origin-top-right">
            {/* User Identity Header */}
            <div className="px-4 py-2.5 border-b border-slate-100">
              <p className="text-xs text-slate-400 font-medium">Signed in as</p>
              <p className="text-sm font-bold text-slate-900 truncate mt-0.5">{user.fullName}</p>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-xs text-slate-500 font-mono truncate">{user.email}</span>
                <Badge
                  variant={user.role === 'admin' ? 'admin' : 'secondary'}
                  className="text-[10px] uppercase font-bold tracking-wider"
                >
                  {user.role}
                </Badge>
              </div>
            </div>

            {/* Menu Items: Profile, Settings, Logout */}
            <div className="p-1.5 space-y-0.5">
              {/* 1. Profile */}
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  navigate('/app/profile');
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950 rounded-xl transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <span>Profile</span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>

              {/* 2. Settings */}
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  navigate('/app/profile');
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950 rounded-xl transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                    <Settings className="h-4 w-4" />
                  </div>
                  <span>Settings</span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 my-1" />

            {/* 3. Logout Item: Single button that turns text into "Confirm Logout" */}
            <div className="p-1.5">
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!confirmLogout) {
                    setConfirmLogout(true);
                  } else {
                    handleFinalLogout();
                  }
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-150 text-left',
                  confirmLogout
                    ? 'bg-red-600 text-white hover:bg-red-700 font-semibold shadow-sm'
                    : 'text-slate-700 hover:bg-red-50 hover:text-red-700',
                )}
              >
                <div
                  className={cn(
                    'h-7 w-7 rounded-lg flex items-center justify-center transition-colors',
                    confirmLogout
                      ? 'bg-red-700 text-white'
                      : 'bg-slate-100 text-slate-600 group-hover:bg-red-100 group-hover:text-red-700',
                  )}
                >
                  <LogOut className="h-4 w-4" />
                </div>
                <span>
                  {confirmLogout
                    ? isLoggingOut
                      ? 'Signing out…'
                      : 'Confirm Logout'
                    : 'Log out'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
