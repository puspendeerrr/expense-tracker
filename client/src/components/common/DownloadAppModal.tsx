import React, { useState } from 'react';
import { Modal, Button, Typography, Flex, Card, Space, Tag } from 'antd';
import {
  DownloadOutlined,
  MobileOutlined,
  BellOutlined,
  QrcodeOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '2.0.0';
export const DOWNLOAD_URL =
  import.meta.env.VITE_ANDROID_DOWNLOAD_URL ||
  'https://github.com/puspendeerrr/expense-tracker/releases/latest/download/SplitWise.apk';

/**
 * Helper to check if running inside Capacitor Android/iOS native runtime
 */
export const isNativePlatform = (): boolean => {
  if (typeof window === 'undefined') return false;
  const win = window as any;
  return Boolean(win.Capacitor?.isNativePlatform && win.Capacitor.isNativePlatform());
};

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadAppModal: React.FC<DownloadAppModalProps> = ({ isOpen, onClose }) => {
  const handleDownload = () => {
    window.open(DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={420}
      centered
      style={{ maxWidth: '96vw' }}
      styles={{
        body: {
          padding: '12px 6px',
        },
      }}
    >
      <Flex vertical align="center" gap={16} style={{ textAlign: 'center' }}>
        {/* Header Icon */}
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.15)',
          }}
        >
          <MobileOutlined />
        </div>

        {/* Title & Version Tag */}
        <div>
          <Title level={4} style={{ margin: 0, fontSize: 18, color: '#0f172a', fontWeight: 700 }}>
            Download SplitWise for Android
          </Title>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
            Get the ultimate shared expense experience on mobile
          </Text>

          <Tag
            color="blue"
            style={{
              borderRadius: 12,
              padding: '2px 10px',
              fontSize: 11,
              fontWeight: 600,
              border: 'none',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              marginTop: 8,
            }}
          >
            Latest Release: v{APP_VERSION}
          </Tag>
        </div>

        {/* Key Features List */}
        <Card
          style={{
            width: '100%',
            borderRadius: 14,
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
          }}
          styles={{ body: { padding: '14px 16px' } }}
        >
          <Flex vertical gap={10} style={{ textAlign: 'left' }}>
            <Flex align="center" gap={10}>
              <BellOutlined style={{ color: '#2563eb', fontSize: 16 }} />
              <div>
                <Text strong style={{ fontSize: 13, display: 'block', color: '#1e293b' }}>
                  Instant Push Notifications
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Get real-time updates when expenses or payments are added
                </Text>
              </div>
            </Flex>

            <Flex align="center" gap={10}>
              <QrcodeOutlined style={{ color: '#2563eb', fontSize: 16 }} />
              <div>
                <Text strong style={{ fontSize: 13, display: 'block', color: '#1e293b' }}>
                  QR Camera Scanner
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Scan group QR codes instantly to join flatmates
                </Text>
              </div>
            </Flex>

            <Flex align="center" gap={10}>
              <ThunderboltOutlined style={{ color: '#2563eb', fontSize: 16 }} />
              <div>
                <Text strong style={{ fontSize: 13, display: 'block', color: '#1e293b' }}>
                  Native UPI App Intent
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Directly launch GPay, PhonePe, Paytm or Cred to settle
                </Text>
              </div>
            </Flex>
          </Flex>
        </Card>

        {/* Installation Instruction Note */}
        <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
          <SafetyCertificateOutlined style={{ marginRight: 4, color: '#16a34a' }} />
          Direct APK download. Tap the downloaded file to install on Android.
        </Text>

        {/* Action Buttons */}
        <Flex vertical gap={8} style={{ width: '100%' }}>
          <Button
            type="primary"
            block
            size="large"
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            style={{
              height: 46,
              borderRadius: 12,
              backgroundColor: '#2563eb',
              fontWeight: 700,
              fontSize: 14,
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
            }}
          >
            Download APK
          </Button>

          <Button
            block
            size="middle"
            onClick={onClose}
            style={{
              borderRadius: 10,
              fontSize: 12,
              color: '#64748b',
              borderColor: '#e2e8f0',
            }}
          >
            Continue on Web
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
};

/**
 * Simple Download App Button CTA component for embedding across screens
 */
export const DownloadAppButton: React.FC<{ style?: React.CSSProperties; size?: 'small' | 'middle' | 'large' }> = ({
  style,
  size = 'middle',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Do not show Download App CTA if already inside Capacitor Native App!
  if (isNativePlatform()) {
    return null;
  }

  return (
    <>
      <Button
        icon={<DownloadOutlined />}
        onClick={() => setIsModalOpen(true)}
        size={size}
        style={{
          borderRadius: 10,
          fontWeight: 600,
          borderColor: '#2563eb',
          color: '#2563eb',
          backgroundColor: '#eff6ff',
          ...style,
        }}
      >
        Download App
      </Button>

      <DownloadAppModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
