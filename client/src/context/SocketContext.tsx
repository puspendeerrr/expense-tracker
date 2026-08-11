import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { notification as antdNotification } from 'antd';
import {
  DollarOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useAuth } from './AuthContext';
import type { AppNotification } from '../types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  clearNotifications: () => void;
  markAllRead: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const getSocketUrl = (): string => {
  const customSocketUrl = (import.meta.env.VITE_SOCKET_URL || '').trim().replace(/\/+$/, '');
  if (customSocketUrl) return customSocketUrl;

  const envUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
  if (envUrl) return envUrl;

  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://expense-tracker-25ic.onrender.com';
  }
  return window.location.origin;
};

const MAX_NOTIFICATIONS = 30;

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'expense:created':
      return <DollarOutlined style={{ color: '#1677ff' }} />;
    case 'expense:updated':
      return <EditOutlined style={{ color: '#faad14' }} />;
    case 'expense:deleted':
      return <DeleteOutlined style={{ color: '#ff4d4f' }} />;
    case 'settlement:created':
      return <SafetyCertificateOutlined style={{ color: '#722ed1' }} />;
    case 'settlement:verified':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    case 'group:member_joined':
      return <TeamOutlined style={{ color: '#13c2c2' }} />;
    default:
      return <BellOutlined style={{ color: '#1677ff' }} />;
  }
};

const getNotificationTitle = (type: string): string => {
  switch (type) {
    case 'expense:created':
      return 'New Expense Added';
    case 'expense:updated':
      return 'Expense Updated';
    case 'expense:deleted':
      return 'Expense Deleted';
    case 'settlement:created':
      return 'Settlement Request';
    case 'settlement:verified':
      return 'Payment Verified';
    case 'group:member_joined':
      return 'New Member';
    default:
      return 'Notification';
  }
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user, group } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const addNotification = useCallback((data: any) => {
    const newNotif: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: data.type || 'general',
      message: data.message || '',
      actorName: data.actorName || '',
      expense: data.expense || null,
      settlement: data.settlement || null,
      expenseId: data.expenseId || data.expense?._id || null,
      timestamp: data.timestamp || new Date().toISOString(),
      read: false,
    };

    setNotifications((prev) => [newNotif, ...prev].slice(0, MAX_NOTIFICATIONS));
    setUnreadCount((prev) => prev + 1);

    // Show AntD notification toast
    antdNotification.open({
      message: getNotificationTitle(data.type),
      description: data.message,
      icon: getNotificationIcon(data.type),
      placement: 'top',
      duration: 4,
      style: {
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      },
    });
  }, []);

  useEffect(() => {
    // Cleanup previous connection
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (!token || !user) {
      setIsConnected(false);
      return;
    }

    const socketUrl = getSocketUrl();
    console.log(`[Socket.IO Client] Connecting to ${socketUrl}`);

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`[Socket.IO Client] Connected — id: ${socket.id}`);
      setIsConnected(true);

      // Join group room if in a group
      if (group?._id) {
        socket.emit('join-group', group._id);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO Client] Disconnected — reason: ${reason}`);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO Client] Connection failed (serverless fallback active):', err.message);
      setIsConnected(false);
    });

    // Listen for all notification events
    socket.on('notification', (data) => {
      console.log('[Socket.IO Client] Received notification:', data.type, data.message);
      addNotification(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token, user?._id, group?._id, addNotification]);

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        notifications,
        unreadCount,
        clearNotifications,
        markAllRead,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
