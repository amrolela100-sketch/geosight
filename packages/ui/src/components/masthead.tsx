import { type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface MastheadProps extends HTMLAttributes<HTMLDivElement> {
  /** Volume label, e.g. "OD / 2026". */
  volume: ReactNode;
  /** Issue label, e.g. "VOL 01 · Nº 26". */
  issue: ReactNode;
  /** Optional status chip shown on the trailing edge. */
  status?: ReactNode;
  /** Optional center segment — used for build hash, locale, etc. */
  middle?: ReactNode;
}

/** Editorial topbar: two thin uppercase tracks separated by a hairline rule.
 * RTL-safe (uses logical justify; no inline margins). */
export function Masthead({
  volume,
  issue,
  status,
  middle,
  className,
  ...props
}: MastheadProps) {
  return (
    <div
      className={cn(
        'border-b border-[var(--line)] py-2.5',
        className,
      )}
      {...props}
    >
      <div className="container flex items-center justify-between gap-6">
        <span className="eyebrow-track">
          <b className="eyebrow-track--strong font-semibold">{volume}</b>
        </span>
        {middle ? <span className="eyebrow-track hidden md:inline-flex">{middle}</span> : null}
        <span className="eyebrow-track flex items-center gap-4">
          <span>{issue}</span>
          {status ?? null}
        </span>
      </div>
    </div>
  );
}
