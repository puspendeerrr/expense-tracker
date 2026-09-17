import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Avatar,
  Tag,
  Typography,
  Space,
  Button,
  Switch,
  Select,
  Form,
  Input,
  Modal,
  Alert,
  Image,
  Upload,
  Tooltip,
  Divider,
} from 'antd';
import {
  UserOutlined,
  CrownOutlined,
  EditOutlined,
  CreditCardOutlined,
  BellOutlined,
  TeamOutlined,
  CopyOutlined,
  CheckOutlined,
  DeleteOutlined,
  UploadOutlined,
  QrcodeOutlined,
  PhoneOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  LogoutOutlined,
  ReloadOutlined,
  DownloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { QRImageEditorModal } from '../components/modals/QRImageEditorModal';
import { isNativePlatform, APP_VERSION, DOWNLOAD_URL, DownloadAppButton } from '../components/common/DownloadAppModal';
import { OwnershipCreditsCard } from '../components/common/OwnershipCredits';
import { checkForLiveUpdate, applyLiveUpdate, getAppVersionInfo, UpdateManifest } from '../utils/appUpdate';
import api from '../services/api';

const { Title, Text } = Typography;

export const Profile: React.FC = () => {
  const { user, group, userRole, logout, refreshUserData } = useAuth();
  const { showSuccess, showError, confirmAction } = useToast();
  const {
    isSupported: pushSupported,
    permission: pushPermission,
    isSubscribed: pushSubscribed,
    isLoading: pushLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
  } = usePushNotifications();
  const navigate = useNavigate();
  const isSuperAdmin = user?.isSuperAdmin || user?.email === 'admin@gmail.com';

  const [copied, setCopied] = useState(false);

  // Edit Profile modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // UPI QR Code state & Editor state
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(user?.qrCodeUrl || null);
  const [qrCodePublicId, setQrCodePublicId] = useState<string | null>(user?.qrCodePublicId || null);
  const [pendingQRBlob, setPendingQRBlob] = useState<Blob | null>(null);

  // QR Image Editor Modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorSourceImage, setEditorSourceImage] = useState<string | null>(null);

  // Admin Payday Settings state
  const [paydayValue, setPaydayValue] = useState<number | null>(group?.payday || null);
  const [isSavingPayday, setIsSavingPayday] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [activeWebVersion, setActiveWebVersion] = useState<string>(APP_VERSION);
  const [activeNativeVersion, setActiveNativeVersion] = useState<string>('2.0.1');
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [availableManifest, setAvailableManifest] = useState<UpdateManifest | null>(null);

  useEffect(() => {
    getAppVersionInfo().then((info) => {
      setActiveWebVersion(info.webVersion);
      setActiveNativeVersion(info.nativeVersion);
    });
  }, []);

  const handleCheckUpdate = async () => {
    try {
      setIsCheckingUpdate(true);
      const result = await checkForLiveUpdate();

      if (result.error) {
        showError(result.error);
        return;
      }

      if (result.requiresNativeUpdate && result.manifest) {
        setAvailableManifest(result.manifest);
        setUpdateModalVisible(true);
      } else if (result.hasUpdate && result.manifest) {
        showSuccess('New web bundle update available! Downloading...');
        const ok = await applyLiveUpdate(result.manifest);
        if (ok) {
          showSuccess('SplitWise updated successfully! Please restart the app to apply changes.');
        } else {
          showError('Failed to apply live update bundle.');
        }
      } else {
        showSuccess(`You're already using the latest version of SplitWise (v${activeNativeVersion})!`);
      }
    } catch (err: any) {
      showError(err?.message || 'Failed to check for updates. Please try again.');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleDownloadAPK = () => {
    const apkUrl = availableManifest?.downloadUrl || DOWNLOAD_URL;
    setUpdateModalVisible(false);
    showSuccess('Opening APK download link...');
    try {
      window.open(apkUrl, '_system');
    } catch (e) {
      showError('Failed to open download link automatically. Please check browser permissions.');
    }
  };

  const copyCode = () => {
    if (group?.inviteCode) {
      navigator.clipboard.writeText(group.inviteCode);
      setCopied(true);
      showSuccess(`Invite code ${group.inviteCode} copied!`);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openEditModal = () => {
    editForm.setFieldsValue({
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      upiId: user?.upiId || '',
    });
    setQrCodeUrl(user?.qrCodeUrl || null);
    setQrCodePublicId(user?.qrCodePublicId || null);
    setPendingQRBlob(null);
    setEditError('');
    setIsEditOpen(true);
  };

  const handleFileSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setEditError('Image size must be under 10MB');
      return false;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      setEditorSourceImage(src);
      setIsEditorOpen(true);
    };
    reader.readAsDataURL(file);
    return false;
  };

  const handleOpenExistingInEditor = () => {
    if (qrCodeUrl) {
      setEditorSourceImage(qrCodeUrl);
      setIsEditorOpen(true);
    }
  };

  const handleApplyEditor = (croppedBlob: Blob, previewUrl: string) => {
    setPendingQRBlob(croppedBlob);
    setQrCodeUrl(previewUrl);
    setIsEditorOpen(false);
  };

  const handleRemoveQR = () => {
    setPendingQRBlob(null);
    setQrCodeUrl(null);
    setQrCodePublicId(null);
  };

  const handleUpdateProfile = async (values: any) => {
    try {
      setIsSaving(true);
      setEditError('');

      let uploadedUrl = qrCodeUrl;
      let uploadedPublicId = qrCodePublicId;

      if (pendingQRBlob) {
        const formData = new FormData();
        formData.append('image', pendingQRBlob, 'payment-qr.jpg');

        const uploadRes = await api.post('/auth/upload-qr', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        uploadedUrl = uploadRes.data.qrCodeUrl;
        uploadedPublicId = uploadRes.data.qrCodePublicId;
      }

      await api.put('/auth/profile', {
        fullName: values.fullName.trim(),
        phone: values.phone.trim(),
        upiId: values.upiId ? values.upiId.trim() : '',
        qrCodeUrl: uploadedUrl,
        qrCodePublicId: uploadedPublicId,
      });

      showSuccess('Profile updated successfully!');
      setIsEditOpen(false);
      await refreshUserData();
    } catch (err: any) {
      console.error('Update Profile Error:', err);
      const msg = err.response?.data?.message || 'Failed to update profile';
      setEditError(msg);
      showError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePushToggle = async (checked: boolean) => {
    if (checked) {
      await subscribePush();
    } else {
      await unsubscribePush();
    }
  };

  const handleSavePayday = async (val: number | null) => {
    try {
      setIsSavingPayday(true);
      await api.put('/groups/payday', { payday: val });
      setPaydayValue(val);
      showSuccess(val ? `Payday cycle set to ${val}th of every month` : 'Payday cycle cleared');
      await refreshUserData();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to update payday setting');
    } finally {
      setIsSavingPayday(false);
    }
  };

  const handleLeaveGroup = () => {
    confirmAction({
      title: 'Leave Group',
      content: 'Are you sure you want to leave this group? Make sure your balances are settled first.',
      onOk: async () => {
        try {
          setActionLoading(true);
          await api.post('/groups/leave');
          showSuccess('You have left the group.');
          await refreshUserData();
          navigate('/no-group');
        } catch (err: any) {
          showError(err.response?.data?.message || 'Failed to leave group');
        } finally {
          setActionLoading(false);
        }
      },
      danger: true,
    });
  };

  const handleDeleteGroup = () => {
    confirmAction({
      title: 'Delete Entire Group',
      content: 'This will permanently delete the group, all expenses, and all settlement records.',
      onOk: async () => {
        try {
          setActionLoading(true);
          await api.delete('/groups');
          showSuccess('Group permanently deleted.');
          await refreshUserData();
          navigate('/no-group');
        } catch (err: any) {
          showError(err.response?.data?.message || 'Failed to delete group');
        } finally {
          setActionLoading(false);
        }
      },
      danger: true,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 600, margin: '0 auto', width: '100%' }}>
      {/* 1. Profile Account Card */}
      <Card style={{ borderRadius: 14 }} styles={{ body: { padding: 16 } }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <Space align="center" size={12}>
            <Avatar
              size={50}
              style={{
                backgroundColor: isSuperAdmin ? '#faad14' : '#2563eb',
                fontSize: 18,
                fontWeight: 600,
              }}
              icon={isSuperAdmin ? <CrownOutlined /> : <UserOutlined />}
            >
              {!isSuperAdmin && user?.fullName?.charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <Title level={5} style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {user?.fullName}
              </Title>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                {user?.email}
              </Text>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                {user?.phone || 'No phone number'}
              </Text>
              {isSuperAdmin ? (
                <Tag color="gold" icon={<CrownOutlined />} style={{ marginTop: 4 }}>
                  Platform Super Admin
                </Tag>
              ) : (
                user?.upiId && (
                  <Tag color="blue" icon={<CreditCardOutlined />} style={{ marginTop: 4, borderRadius: 4 }}>
                    UPI: {user.upiId}
                  </Tag>
                )
              )}
            </div>
          </Space>

          <Button size="small" icon={<EditOutlined />} onClick={openEditModal} style={{ borderRadius: 8 }}>
            Edit
          </Button>
        </div>

        {/* Saved QR Code preview for normal users */}
        {!isSuperAdmin && user?.qrCodeUrl && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Image
                src={user.qrCodeUrl}
                alt="Payment QR"
                width={40}
                height={40}
                style={{ borderRadius: 6, objectFit: 'contain', border: '1px solid #e2e8f0' }}
              />
              <div>
                <Text strong style={{ fontSize: 12, display: 'block' }}>
                  Payment QR Code Active
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Flatmates can scan to pay you directly
                </Text>
              </div>
            </div>

            <Button size="small" type="text" onClick={openEditModal} style={{ fontSize: 11, color: '#2563eb' }}>
              Change QR
            </Button>
          </div>
        )}
      </Card>

      {/* 2. Push Notifications Preferences Card */}
      <Card style={{ borderRadius: 14 }} styles={{ body: { padding: 16 } }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space size={10} align="center">
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: pushSubscribed ? '#f0fdf4' : '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${pushSubscribed ? '#bbf7d0' : '#e2e8f0'}`,
              }}
            >
              <BellOutlined style={{ fontSize: 16, color: pushSubscribed ? '#16a34a' : '#64748b' }} />
            </div>
            <div>
              <Text strong style={{ fontSize: 13, display: 'block' }}>
                Push Notifications
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {pushSubscribed ? 'Active — receive instant expense & settlement alerts' : 'Disabled — turn on to get expense alerts'}
              </Text>
            </div>
          </Space>

          <Switch
            checked={pushSubscribed}
            loading={pushLoading}
            disabled={!pushSupported || pushPermission === 'denied'}
            onChange={handlePushToggle}
            style={{ backgroundColor: pushSubscribed ? '#16a34a' : undefined }}
          />
        </div>
      </Card>

      {/* 3. Group Membership & Settings Card (Normal Users) */}
      {!isSuperAdmin && (
        group ? (
          <Card
            title={
              <Space size={6}>
                <TeamOutlined style={{ color: '#2563eb' }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Group: {group.name}</span>
              </Space>
            }
            style={{ borderRadius: 14 }}
            styles={{ body: { padding: 14 } }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Your Role</Text>
                <Tag color={userRole === 'creator' ? 'gold' : 'blue'} icon={userRole === 'creator' ? <CrownOutlined /> : undefined} style={{ margin: 0, borderRadius: 4 }}>
                  {userRole === 'creator' ? 'Admin' : 'Member'}
                </Tag>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Invite Code</Text>
                <Space size={4}>
                  <Text code style={{ fontSize: 13, fontWeight: 700 }}>{group.inviteCode}</Text>
                  <Button size="small" icon={copied ? <CheckOutlined style={{ color: '#16a34a' }} /> : <CopyOutlined />} onClick={copyCode}>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </Space>
              </div>

              {/* Admin Payday Settings */}
              {userRole === 'creator' && (
                <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text strong style={{ fontSize: 12 }}>Monthly Payday Cycle</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>Auto-calculates dues</Text>
                  </div>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="Select monthly payday day"
                    value={paydayValue}
                    loading={isSavingPayday}
                    onChange={handleSavePayday}
                    allowClear
                    options={[
                      ...Array.from({ length: 31 }, (_, i) => ({
                        value: i + 1,
                        label: `${i + 1}${i + 1 === 1 ? 'st' : i + 1 === 2 ? 'nd' : i + 1 === 3 ? 'rd' : 'th'} of every month`,
                      })),
                    ]}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                <Button danger block onClick={handleLeaveGroup} loading={actionLoading} style={{ fontSize: 12 }}>
                  Leave Group
                </Button>
                {userRole === 'creator' && (
                  <Button danger type="primary" block onClick={handleDeleteGroup} loading={actionLoading} style={{ fontSize: 12 }}>
                    Delete Group
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card style={{ borderRadius: 14, textAlign: 'center', padding: 20 }}>
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
              You are not part of any flatmate group currently.
            </Text>
            <Button type="primary" onClick={() => navigate('/no-group')} style={{ borderRadius: 10, background: '#2563eb' }}>
              Join or Create Group
            </Button>
          </Card>
        )
      )}

      {/* About SplitWise & Application Version Card */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SettingOutlined style={{ color: '#2563eb' }} />
            <span>About SplitWise</span>
          </div>
        }
        style={{ borderRadius: 14, marginTop: 16 }}
        styles={{ body: { padding: 18 } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={5} style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              SplitWise Pro {isNativePlatform() ? '(Android Native)' : '(Web)'}
            </Title>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
              Web Bundle v{activeWebVersion} · Native v{activeNativeVersion}
            </Text>
          </div>

          <div>
            {isNativePlatform() ? (
              <Button
                type="primary"
                ghost
                size="middle"
                icon={<ReloadOutlined spin={isCheckingUpdate} />}
                loading={isCheckingUpdate}
                onClick={handleCheckUpdate}
                style={{ borderRadius: 10, borderColor: '#2563eb', color: '#2563eb' }}
              >
                Check for Updates
              </Button>
            ) : (
              <DownloadAppButton size="middle" />
            )}
          </div>
        </div>
      </Card>

      {/* Ownership & Credits Card */}
      <OwnershipCreditsCard />

      {/* Edit Profile Modal */}
      <Modal
        open={isEditOpen}
        onCancel={() => setIsEditOpen(false)}
        title={
          <span style={{ fontWeight: 600, fontSize: 16 }}>
            {isSuperAdmin ? 'Edit Administrator Profile' : 'Edit Profile & Payment Details'}
          </span>
        }
        footer={null}
        centered
        destroyOnClose
        width={440}
        style={{ maxWidth: 'calc(100vw - 16px)', margin: '8px auto' }}
      >
        {editError && (
          <Alert
            message={editError}
            type="error"
            showIcon
            closable
            onClose={() => setEditError('')}
            style={{ marginBottom: 14, borderRadius: 8 }}
          />
        )}

        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdateProfile}
          requiredMark={false}
        >
          <Form.Item
            label={<Text strong style={{ fontSize: 13 }}>Full Name</Text>}
            name="fullName"
            rules={[{ required: true, message: 'Please enter your full name' }]}
            style={{ marginBottom: 12 }}
          >
            <Input prefix={<UserOutlined />} size="large" />
          </Form.Item>

          <Form.Item
            label={<Text strong style={{ fontSize: 13 }}>Phone Number</Text>}
            name="phone"
            rules={[{ required: true, message: 'Please enter your phone number' }]}
            style={{ marginBottom: 12 }}
          >
            <Input prefix={<PhoneOutlined />} size="large" />
          </Form.Item>

          {!isSuperAdmin && (
            <>
              <Form.Item
                label={<Text strong style={{ fontSize: 13 }}>UPI ID / VPA (Optional)</Text>}
                name="upiId"
                tooltip="Your flatmates will see this when settling dues"
                style={{ marginBottom: 14 }}
              >
                <Input prefix={<CreditCardOutlined />} placeholder="e.g. john@okicici or 9876543210@paytm" size="large" />
              </Form.Item>

              {/* UPI QR Code Editor Section */}
              <Form.Item
                label={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Text strong style={{ fontSize: 13 }}>UPI Payment QR Code Image</Text>
                    {qrCodeUrl && (
                      <Tag color="green" icon={<CheckCircleOutlined />} style={{ margin: 0, fontSize: 11 }}>
                        Active
                      </Tag>
                    )}
                  </div>
                }
                style={{ marginBottom: 16 }}
              >
                {qrCodeUrl ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      background: '#f8fafc',
                      gap: 8,
                    }}
                  >
                    <Tooltip title="Click image to crop, rotate or zoom">
                      <div
                        onClick={handleOpenExistingInEditor}
                        style={{
                          width: 120,
                          height: 120,
                          borderRadius: 8,
                          border: '1.5px solid #cbd5e1',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          background: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <img
                          src={qrCodeUrl}
                          alt="Payment QR"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </div>
                    </Tooltip>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="small" icon={<EditOutlined />} onClick={handleOpenExistingInEditor}>
                        Edit Crop / Rotate
                      </Button>

                      <Upload
                        beforeUpload={handleFileSelect}
                        showUploadList={false}
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                      >
                        <Button size="small" icon={<UploadOutlined />}>
                          Replace
                        </Button>
                      </Upload>

                      <Button size="small" danger icon={<DeleteOutlined />} onClick={handleRemoveQR}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Upload
                    beforeUpload={handleFileSelect}
                    showUploadList={false}
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                  >
                    <div
                      style={{
                        width: '100%',
                        minHeight: 90,
                        borderRadius: 10,
                        border: '1.5px dashed #cbd5e1',
                        background: '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        padding: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <QrcodeOutlined style={{ fontSize: 24, color: '#2563eb' }} />
                      <Text strong style={{ fontSize: 12, color: '#2563eb' }}>
                        Upload QR Code Screenshot
                      </Text>
                    </div>
                  </Upload>
                )}
              </Form.Item>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button onClick={() => setIsEditOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={isSaving} style={{ background: '#2563eb' }}>
              Save Profile
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Interactive QR Image Editor Modal */}
      <QRImageEditorModal
        isOpen={isEditorOpen}
        imageSrc={editorSourceImage}
        onClose={() => setIsEditorOpen(false)}
        onApply={handleApplyEditor}
      />

      {/* Native APK Update Modal */}
      <Modal
        open={updateModalVisible}
        onCancel={() => setUpdateModalVisible(false)}
        footer={null}
        title={
          <Space align="center">
            <ThunderboltOutlined style={{ color: '#2563eb', fontSize: 20 }} />
            <Text strong style={{ fontSize: 16 }}>
              SplitWise App Update Available
            </Text>
          </Space>
        }
      >
        <div style={{ padding: '12px 0' }}>
          <Tag color="blue" style={{ marginBottom: 12, padding: '4px 10px', fontSize: 12, borderRadius: 6 }}>
            Version v{availableManifest?.version || '2.0.1'} Available
          </Tag>

          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              Installed Native Version: <strong>v{activeNativeVersion}</strong>
            </Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              Latest Version: <strong>v{availableManifest?.version || '2.0.1'}</strong>
            </Text>
          </div>

          {availableManifest?.releaseNotes && (
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                What's New in this Release:
              </Text>
              <div style={{ background: '#f1f5f9', padding: 10, borderRadius: 8, fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
                {availableManifest.releaseNotes}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <Button onClick={() => setUpdateModalVisible(false)}>
              Remind Me Later
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleDownloadAPK}
              style={{ background: '#2563eb', fontWeight: 600 }}
            >
              Download & Install APK
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
