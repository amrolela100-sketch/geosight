import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        'border-border bg-background placeholder:text-muted-foreground/70 flex h-10 w-full rounded-md border px-3 py-2 text-sm outline-none transition',
        'focus:border-primary focus:ring-primary focus:ring-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-destructive focus:border-destructive focus:ring-destructive',
        className,
      )}
      {...props}
    />
  );
});
