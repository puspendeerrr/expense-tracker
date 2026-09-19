import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatPaise, formatPaiseCompact } from '@/lib/money';
import type { AnalyticsRegion, ChartRegion } from '@/types/domain';
import type { ChartGrouping } from '@/hooks/useDashboardData';

/**
 * Spending analytics.
 *
 * Palette: categorical slots 1 and 2 of the validated default palette, used because the
 * two lines are distinct *series* (group total vs. my share) rather than magnitudes of
 * one thing. The pair was checked with the palette validator against a white surface:
 * CVD ΔE 24.7, normal-vision ΔE 33.6, both comfortably clear of the floors.
 *
 * The bar charts encode magnitude by length, so they use a single hue throughout -
 * colouring bars by rank would imply an identity the data does not have.
 *
 * One y-axis only. Group total and my share share a unit (rupees) and a scale, so they
 * belong on one axis; a second axis would silently rescale one series against the other.
 */

const SERIES_TOTAL = '#2a78d6';
const SERIES_MINE = '#eb6834';
const BAR_HUE = '#2a78d6';

const AXIS_TICK = { fill: '#64748b', fontSize: 11 };
const GRID_STROKE = '#e2e8f0';

interface ChartTooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

const MoneyTooltip: React.FC<{
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string | number;
}> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-slate-900">{label}</p>
      {payload.map((item) => (
        <div key={String(item.dataKey)} className="flex items-center gap-2 text-xs">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {/* Text stays in ink; the swatch carries the identity. */}
          <span className="text-slate-500">{item.name}</span>
          <span className="ml-auto font-mono font-semibold tabular-nums text-slate-900">
            {formatPaise(Number(item.value ?? 0) * 100)}
          </span>
        </div>
      ))}
    </div>
  );
};

const EmptyChart: React.FC<{ message: string; icon: React.ReactNode }> = ({
  message,
  icon,
}) => (
  <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
    <span className="text-slate-300">{icon}</span>
    <p className="max-w-[24ch] text-sm font-medium text-slate-500">{message}</p>
  </div>
);

const GROUPINGS: { value: ChartGrouping; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

interface SpendingAnalyticsProps {
  chart: ChartRegion | null;
  analytics: AnalyticsRegion | null;
  chartLoading: boolean;
  chartRefreshing: boolean;
  chartError: string | null;
  analyticsLoading: boolean;
  groupBy: ChartGrouping;
  onGroupByChange: (grouping: ChartGrouping) => void;
  onRetryChart: () => void;
}

export const SpendingAnalytics: React.FC<SpendingAnalyticsProps> = ({
  chart,
  analytics,
  chartLoading,
  chartRefreshing,
  chartError,
  analyticsLoading,
  groupBy,
  onGroupByChange,
  onRetryChart,
}) => {
  const series = (chart?.periodBreakdown ?? []).map((bucket) => ({
    label: bucket.label,
    total: bucket.totalExpensePaise / 100,
    mine: bucket.mySharePaise / 100,
  }));

  const topPaidFor = (analytics?.topPeopleIPaidFor ?? []).map((row) => ({
    person: row.person,
    value: row.paise / 100,
  }));

  const topPaidForMe = (analytics?.topPeopleWhoPaidForMe ?? []).map((row) => ({
    person: row.person,
    value: row.paise / 100,
  }));

  return (
    <section aria-labelledby="analytics-heading" className="space-y-3">
      <h2
        id="analytics-heading"
        className="flex items-center gap-2 text-sm font-bold text-slate-900"
      >
        <TrendingUp className="h-4 w-4 text-slate-400" />
        Spending analytics
      </h2>

      {/* ---- Spending over time ---- */}
      <div
        className={cn(
          'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-opacity',
          chartRefreshing && 'opacity-70',
        )}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Spending over time</h3>

          {/* Changing the grouping refetches the chart region only. */}
          <div
            className="flex rounded-lg bg-slate-100 p-0.5"
            role="group"
            aria-label="Chart grouping"
          >
            {GROUPINGS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onGroupByChange(option.value)}
                aria-pressed={groupBy === option.value}
                className={cn(
                  // Full touch target on phones; compact on pointer devices.
                  'min-h-[44px] rounded-md px-3 text-xs font-semibold transition-colors sm:min-h-[32px] sm:px-2.5',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  groupBy === option.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {chartError ? (
          <div className="flex h-[220px] flex-col items-center justify-center gap-3">
            <p className="text-sm text-slate-500">{chartError}</p>
            <Button size="sm" variant="outline" onClick={onRetryChart}>
              Retry
            </Button>
          </div>
        ) : chartLoading ? (
          <Skeleton className="h-[220px] w-full rounded-xl" />
        ) : series.length === 0 ? (
          <EmptyChart
            message="No spending in this period. Add an expense or widen the date range."
            icon={<TrendingUp className="h-8 w-8" />}
          />
        ) : (
          <>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {/* No negative left margin: it clipped the leading digit of the
                    y-axis labels at phone widths. */}
                <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  {/* Recessive grid: horizontal only, no vertical clutter. */}
                  <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={{ stroke: GRID_STROKE }}
                    minTickGap={16}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tickFormatter={(value: number) => formatPaiseCompact(value * 100)}
                  />
                  <Tooltip
                    content={<MoneyTooltip />}
                    cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12, color: '#475569' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Group spending"
                    stroke={SERIES_TOTAL}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="mine"
                    name="My share"
                    stroke={SERIES_MINE}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#ffffff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {chart?.grouping && (
              <p className="mt-1 text-center text-xs text-slate-400">
                Grouped by {chart.grouping}
              </p>
            )}
          </>
        )}
      </div>

      {/* ---- Top people ---- */}
      <div className="grid gap-3 lg:grid-cols-2">
        <TopPeopleCard
          title="I paid most for"
          data={topPaidFor}
          isLoading={analyticsLoading}
          emptyMessage="You have not covered anyone's share in this period."
        />
        <TopPeopleCard
          title="Paid most for me"
          data={topPaidForMe}
          isLoading={analyticsLoading}
          emptyMessage="Nobody has covered your share in this period."
        />
      </div>
    </section>
  );
};

interface TopPeopleCardProps {
  title: string;
  data: { person: string; value: number }[];
  isLoading: boolean;
  emptyMessage: string;
}

/**
 * Horizontal bars: magnitude by length, one hue throughout.
 *
 * Values are direct-labelled on the axis side rather than printed on every bar, and the
 * single series needs no legend because the card title names it.
 */
const TopPeopleCard: React.FC<TopPeopleCardProps> = ({
  title,
  data,
  isLoading,
  emptyMessage,
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>

    {isLoading ? (
      <Skeleton className="h-[180px] w-full rounded-xl" />
    ) : data.length === 0 ? (
      <EmptyChart message={emptyMessage} icon={<BarChart3 className="h-8 w-8" />} />
    ) : (
      <div style={{ height: Math.max(140, data.length * 44) }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
            barCategoryGap={8}
          >
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => formatPaiseCompact(value * 100)}
            />
            <YAxis
              type="category"
              dataKey="person"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={92}
            />
            <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#f1f5f9' }} />
            {/* 4px rounded data-end, square against the baseline. */}
            <Bar dataKey="value" name={title} radius={[0, 4, 4, 0]} maxBarSize={22}>
              {data.map((entry) => (
                <Cell key={entry.person} fill={BAR_HUE} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);
