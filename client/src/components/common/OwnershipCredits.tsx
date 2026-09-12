import React from 'react';
import { ExternalLink, Heart } from 'lucide-react';
import { Card, Typography } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';

const { Text } = Typography;

export const OwnershipCredits: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`bg-slate-50/90 dark:bg-slate-900/90 rounded-2xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm ${className}`}>
      {/* Section Title */}
      <div className="flex items-center gap-2.5 mb-6">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100 font-sans">
          Ownership & Credits
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs leading-relaxed">
        {/* Product Ownership */}
        <div className="space-y-4">
          <div>
            <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Product Ownership
            </h4>
            <p className="text-slate-700 dark:text-slate-300 font-medium">
              This product is owned and maintained by{' '}
              <a
                href="https://algorithyum.in"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline underline-offset-2 decoration-emerald-500/40 hover:decoration-emerald-500 transition-all duration-200 cursor-pointer inline-flex items-center gap-1 group"
              >
                <span>Algorithmyum Software Solutions</span>
                <ExternalLink className="w-3 h-3 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
              </a>.
            </p>
          </div>

          <div className="pt-1">
            <span className="font-bold text-slate-900 dark:text-slate-100">Owner: </span>
            <a
              href="https://puspender.in"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline underline-offset-2 transition-colors duration-200 cursor-pointer"
            >
              Puspender Kumar
            </a>
          </div>
        </div>

        {/* Development Credits */}
        <div className="space-y-4">
          <div>
            <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Development Credits
            </h4>
            <p className="text-slate-700 dark:text-slate-300 font-medium mb-2.5 flex items-center gap-1.5">
              <span>Developed with</span>
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline-block animate-pulse" />
              <span>by:</span>
            </p>
            <ul className="space-y-2 pl-1">
              <li className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                <span className="text-emerald-500 font-bold">•</span>
                <a
                  href="https://puspender.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline underline-offset-2 transition-all duration-200 cursor-pointer"
                >
                  Puspender Kumar
                </a>
              </li>
              <li className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                <span className="text-emerald-500 font-bold">•</span>
                <a
                  href="https://chaten.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline underline-offset-2 transition-all duration-200 cursor-pointer"
                >
                  Chaten Toor
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Ecosystem Tagline */}
      <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-medium leading-normal">
        Expense Tracker is a product under the Algorithmyum Software Solutions ecosystem.
      </div>
    </div>
  );
};

export const OwnershipCreditsCard: React.FC = () => {
  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SafetyCertificateOutlined style={{ color: '#2563eb' }} />
          <span>Ownership & Credits</span>
        </div>
      }
      style={{ borderRadius: 14, marginTop: 16 }}
      styles={{ body: { padding: 18 } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {/* Product Ownership */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Product Ownership
            </Text>
            <Text style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
              This product is owned and maintained by{' '}
              <a
                href="https://algorithyum.in"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                className="hover:underline hover:text-blue-700 transition-all cursor-pointer inline-flex items-center gap-1"
              >
                <span>Algorithmyum Software Solutions</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>.
            </Text>
            <div style={{ marginTop: 4 }}>
              <Text strong style={{ fontSize: 13, color: '#1e293b' }}>Owner: </Text>
              <a
                href="https://puspender.in"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                className="hover:underline hover:text-blue-700 transition-all cursor-pointer"
              >
                Puspender Kumar
              </a>
            </div>
          </div>

          {/* Development Credits */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Development Credits
            </Text>
            <Text style={{ fontSize: 13, color: '#334155' }}>
              Developed with ❤️ by:
            </Text>
            <ul style={{ margin: 0, paddingLeft: 16, listStyleType: 'disc', color: '#2563eb' }}>
              <li style={{ marginBottom: 4 }}>
                <a
                  href="https://puspender.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#1e293b', fontWeight: 600, textDecoration: 'none' }}
                  className="hover:text-blue-600 hover:underline transition-all cursor-pointer"
                >
                  Puspender Kumar
                </a>
              </li>
              <li>
                <a
                  href="https://chaten.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#1e293b', fontWeight: 600, textDecoration: 'none' }}
                  className="hover:text-blue-600 hover:underline transition-all cursor-pointer"
                >
                  Chaten Toor
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Small Ecosystem Line */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, fontSize: 12, color: '#64748b', fontWeight: 500 }}>
          Expense Tracker is a product under the Algorithmyum Software Solutions ecosystem.
        </div>
      </div>
    </Card>
  );
};
