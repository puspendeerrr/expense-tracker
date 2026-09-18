import React, { useState, useEffect } from 'react';
import { Modal, Select, DatePicker, Button, Space, Typography, Alert, Spin, Tag } from 'antd';
import { FileExcelOutlined, DownloadOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  ReportFilters,
  DatePreset,
  PaymentModeFilter,
  InvolvementFilter,
  PRESET_LABELS,
  INVOLVEMENT_LABELS,
  PAYMENT_MODE_LABELS,
  resolveRange,
  isRangeIncomplete,
  toLocalDateString,
} from '../../hooks/useReportFilters';
import { ReportPerson } from '../../types/reports';

const { Text } = Typography;

interface ExportExcelModalProps {
  open: boolean;
  onClose: () => void;
  /** Dashboard filters, used as the starting point so the export defaults to what is on screen. */
  initialFilters: ReportFilters;
  members: ReportPerson[];
  currentUserId?: string;
  isExporting: boolean;
  onExport: (filters: ReportFilters) => Promise<void>;
}

const PRESET_OPTIONS: { label: string; value: DatePreset }[] = [
  'today', 'this_week', 'this_month', 'last_month', 'last_30_days', 'this_year', 'all_time', 'custom',
].map((v) => ({ label: PRESET_LABELS[v as DatePreset], value: v as DatePreset }));

/**
 * Export dialog. It opens pre-loaded with the dashboard's current filters, so "what you see is
 * what you export" by default, while still allowing the scope to be changed before generating.
 */
export const ExportExcelModal: React.FC<ExportExcelModalProps> = ({
  open,
  onClose,
  initialFilters,
  members,
  currentUserId,
  isExporting,
  onExport,
}) => {
  const [draft, setDraft] = useState<ReportFilters>(initialFilters);

  // Re-sync whenever the dialog is reopened, so it always mirrors the live dashboard scope.
  useEffect(() => {
    if (open) setDraft(initialFilters);
  }, [open, initialFilters]);

  const set = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const range = resolveRange(draft);
  const incomplete = isRangeIncomplete(draft);

  const memberOptions = [
    { label: 'All Members', value: 'all' },
    ...members.filter((m) => m._id !== currentUserId).map((m) => ({ label: m.fullName, value: m._id })),
  ];

  const customValue: [Dayjs, Dayjs] | null =
    draft.customFrom && draft.customTo ? [dayjs(draft.customFrom), dayjs(draft.customTo)] : null;

  const handleRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (!dates || !dates[0] || !dates[1]) {
      set('customFrom', null);
      set('customTo', null);
      return;
    }
    setDraft((prev) => ({
      ...prev,
      customFrom: toLocalDateString(dates[0]!.toDate()),
      customTo: toLocalDateString(dates[1]!.toDate()),
    }));
  };

  const field = (label: string, control: React.ReactNode) => (
    <label style={{ display: 'block' }}>
      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{label}</Text>
      {control}
    </label>
  );

  return (
    <Modal
      open={open}
      onCancel={isExporting ? undefined : onClose}
      maskClosable={!isExporting}
      closable={!isExporting}
      width={430}
      centered
      title={
        <Space size={8} align="center">
          <FileExcelOutlined style={{ color: '#16a34a', fontSize: 16 }} aria-hidden="true" />
          <span>Export Financial Report</span>
        </Space>
      }
      footer={[
        <Button key="cancel" onClick={onClose} disabled={isExporting} style={{ borderRadius: 8 }}>
          Cancel
        </Button>,
        <Button
          key="export"
          type="primary"
          icon={<DownloadOutlined />}
          loading={isExporting}
          disabled={incomplete}
          onClick={() => onExport(draft)}
          style={{ borderRadius: 8, background: '#16a34a' }}
        >
          {isExporting ? 'Preparing…' : 'Export Excel'}
        </Button>,
      ]}
    >
      {isExporting ? (
        <div style={{ padding: '28px 0', textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: 14 }}>
            <Text strong style={{ fontSize: 13, display: 'block' }}>Preparing your report…</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Building the workbook for {range.label}.
            </Text>
          </div>
        </div>
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%', paddingTop: 4 }}>
          {field(
            'Date Range',
            <Select
              value={draft.preset}
              onChange={(v) => set('preset', v)}
              options={PRESET_OPTIONS}
              style={{ width: '100%' }}
              aria-label="Export date range"
            />
          )}

          {draft.preset === 'custom' &&
            field(
              'Custom Range',
              <DatePicker.RangePicker
                value={customValue}
                onChange={handleRangeChange as never}
                format="DD MMM YYYY"
                style={{ width: '100%' }}
                disabledDate={(d) => d && d.isAfter(dayjs().endOf('day'))}
                aria-label="Export custom date range"
              />
            )}

          {field(
            'Person',
            <Select
              value={draft.memberId}
              onChange={(v) => set('memberId', v)}
              options={memberOptions}
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="label"
              aria-label="Export person filter"
            />
          )}

          {field(
            'Payment',
            <Select
              value={draft.paymentMode}
              onChange={(v) => set('paymentMode', v as PaymentModeFilter)}
              options={[
                { label: PAYMENT_MODE_LABELS.all, value: 'all' },
                { label: PAYMENT_MODE_LABELS.cash, value: 'cash' },
                { label: PAYMENT_MODE_LABELS.upi, value: 'upi' },
              ]}
              style={{ width: '100%' }}
              aria-label="Export payment mode filter"
            />
          )}

          {field(
            'Involvement',
            <Select
              value={draft.involvement}
              onChange={(v) => set('involvement', v as InvolvementFilter)}
              options={[
                { label: INVOLVEMENT_LABELS.all, value: 'all' },
                { label: INVOLVEMENT_LABELS.involving_me, value: 'involving_me' },
                { label: INVOLVEMENT_LABELS.paid_by_me, value: 'paid_by_me' },
                { label: INVOLVEMENT_LABELS.paid_by_others_for_me, value: 'paid_by_others_for_me' },
              ]}
              style={{ width: '100%' }}
              aria-label="Export involvement filter"
            />
          )}

          {incomplete ? (
            <Alert
              type="warning"
              showIcon
              message="Pick both a start and an end date to continue."
              style={{ borderRadius: 10 }}
            />
          ) : (
            <div
              style={{
                padding: '10px 12px',
                background: '#f8fafc',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
              }}
            >
              <Space size={6} align="start">
                <CalendarOutlined style={{ color: '#2563eb', fontSize: 12, marginTop: 2 }} aria-hidden="true" />
                <div>
                  <Text style={{ fontSize: 11.5, display: 'block' }}>
                    Exporting <strong>{range.label}</strong>
                  </Text>
                  <Space size={4} wrap style={{ marginTop: 4 }}>
                    <Tag style={{ margin: 0, fontSize: 10, borderRadius: 4 }}>
                      {draft.memberId === 'all'
                        ? 'All Members'
                        : members.find((m) => m._id === draft.memberId)?.fullName || 'Member'}
                    </Tag>
                    <Tag style={{ margin: 0, fontSize: 10, borderRadius: 4 }}>
                      {PAYMENT_MODE_LABELS[draft.paymentMode]}
                    </Tag>
                    <Tag style={{ margin: 0, fontSize: 10, borderRadius: 4 }}>
                      {INVOLVEMENT_LABELS[draft.involvement]}
                    </Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 10.5, display: 'block', marginTop: 6 }}>
                    6 sheets: Summary, Expenses, Expense Splits, Person-wise Relationship,
                    Settlements and a period breakdown.
                  </Text>
                </div>
              </Space>
            </div>
          )}
        </Space>
      )}
    </Modal>
  );
};
