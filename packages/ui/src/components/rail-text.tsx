import { type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface RailTextProps extends HTMLAttributes<HTMLDivElement> {
  /** Side the rail sits on. Drives writing-mode direction. */
  side?: 'left' | 'right';
  children: ReactNode;
}

/** Vertical typographic rail used as decorative metadata in the editorial
 * theme. Hidden below md to avoid stealing horizontal space on mobile. */
export function RailText({ side = 'right', className, children, ...props }: RailTextProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-y-0 hidden w-10 md:flex md:items-center md:justify-center',
        side === 'right' ? 'right-2' : 'left-2',
        className,
      )}
      {...props}
    >
      <span
        className="rail-text"
        style={{
          transform: side === 'right' ? 'rotate(180deg)' : undefined,
        }}
      >
        {children}
      </span>
    </div>
  );
}
