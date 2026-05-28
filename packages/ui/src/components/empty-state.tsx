import { type ComponentType, type ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'border-border bg-card/20 flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <div className="text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      ) : null}
      <p className="text-sm font-medium text-white">{title}</p>
      {description ? (
        <p className="text-muted-foreground max-w-md text-sm leading-6">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
