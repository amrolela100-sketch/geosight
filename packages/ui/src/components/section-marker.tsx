import { type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'] as const;

export interface SectionMarkerProps extends HTMLAttributes<HTMLDivElement> {
  /** 1-based section index (1 → "I", 2 → "II", …, 12 → "XII"). */
  index: number;
  /** Section name shown next to the Roman numeral. */
  label: ReactNode;
  /** Optional "Nº NNN / NNN" pagination shown on the trailing edge. */
  pagination?: { current: number; total: number };
}

export function SectionMarker({
  index,
  label,
  pagination,
  className,
  ...props
}: SectionMarkerProps) {
  const numeral = ROMAN[index - 1] ?? String(index);
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-6 border-b border-[var(--line)] pb-3',
        className,
      )}
      {...props}
    >
      <div className="flex items-baseline gap-3">
        <span className="display-serif text-[28px] leading-none">{numeral}.</span>
        <span className="eyebrow-track eyebrow-track--strong">{label}</span>
      </div>
      {pagination ? (
        <span className="meta-mono">
          Nº {String(pagination.current).padStart(3, '0')} /{' '}
          {String(pagination.total).padStart(3, '0')}
        </span>
      ) : null}
    </div>
  );
}
