'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type TrendChartPoint = {
  /** ISO date YYYY-MM-DD. */
  date: string;
  /** GEO score, 0..100. */
  avgGeoScore: number;
  totalScans: number;
};

type Props = {
  data: readonly TrendChartPoint[];
  /** Locale BCP-47 — drives X-axis date formatting. */
  locale: string;
  /** Tooltip / a11y label for the score line. */
  scoreLabel: string;
  scansLabel: string;
  /** Rendered when `data` is empty. */
  emptyLabel: string;
};

const GEMINI_BLUE = 'hsl(217 89% 61%)';
const GEMINI_VIOLET = 'hsl(266 42% 62%)';

export function GeoScoreTrendChart({ data, locale, scoreLabel, scansLabel, emptyLabel }: Props) {
  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
    [locale],
  );

  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[260px] items-center justify-center text-sm">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={[...data]} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="geo-score-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GEMINI_BLUE} stopOpacity={0.45} />
              <stop offset="100%" stopColor={GEMINI_VIOLET} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(0 0% 100% / 0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => formatter.format(new Date(`${value}T00:00:00Z`))}
            stroke="hsl(0 0% 100% / 0.35)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            minTickGap={24}
          />
          <YAxis
            domain={[0, 100]}
            stroke="hsl(0 0% 100% / 0.35)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={32}
          />
          <Tooltip
            cursor={{ stroke: 'hsl(0 0% 100% / 0.18)', strokeDasharray: '3 3' }}
            contentStyle={{
              background: 'hsl(232 34% 10% / 0.92)',
              border: '1px solid hsl(0 0% 100% / 0.12)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'hsl(0 0% 95%)',
            }}
            labelFormatter={(label: string) => formatter.format(new Date(`${label}T00:00:00Z`))}
            formatter={(value: number, key: string) => [
              key === 'avgGeoScore' ? value.toFixed(1) : Math.round(value),
              key === 'avgGeoScore' ? scoreLabel : scansLabel,
            ]}
          />
          <Area
            type="monotone"
            dataKey="avgGeoScore"
            stroke={GEMINI_BLUE}
            strokeWidth={2}
            fill="url(#geo-score-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
