'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type ProviderBarPoint = {
  provider: string;
  /** Display label (e.g. "ChatGPT"). */
  label: string;
  scans: number;
  mentions: number;
};

type Props = {
  data: readonly ProviderBarPoint[];
  scansLabel: string;
  mentionsLabel: string;
  emptyLabel: string;
};

const GEMINI_BLUE = 'hsl(217 89% 61%)';
const GEMINI_VIOLET = 'hsl(266 42% 62%)';

export function ProviderBreakdownChart({ data, scansLabel, mentionsLabel, emptyLabel }: Props) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...data]} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="hsl(0 0% 100% / 0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="hsl(0 0% 100% / 0.35)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <YAxis
            stroke="hsl(0 0% 100% / 0.35)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={32}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'hsl(0 0% 100% / 0.04)' }}
            contentStyle={{
              background: 'hsl(232 34% 10% / 0.92)',
              border: '1px solid hsl(0 0% 100% / 0.12)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'hsl(0 0% 95%)',
            }}
            formatter={(value: number, key: string) => [
              Math.round(value),
              key === 'scans' ? scansLabel : mentionsLabel,
            ]}
          />
          <Bar dataKey="scans" fill={GEMINI_BLUE} radius={[6, 6, 0, 0]} isAnimationActive={false} />
          <Bar
            dataKey="mentions"
            fill={GEMINI_VIOLET}
            radius={[6, 6, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
