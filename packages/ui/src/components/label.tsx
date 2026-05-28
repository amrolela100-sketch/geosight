import { forwardRef, type LabelHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  hint?: ReactNode;
  error?: ReactNode;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, children, hint, error, ...props },
  ref,
) {
  return (
    <label
      ref={ref}
      className={cn('flex flex-col gap-1.5 text-sm', className)}
      {...props}
    >
      {children}
      {error ? (
        <span className="text-destructive text-xs">{error}</span>
      ) : hint ? (
        <span className="text-muted-foreground text-xs">{hint}</span>
      ) : null}
    </label>
  );
});
