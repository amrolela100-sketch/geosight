import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '../lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border font-medium',
  {
    variants: {
      tone: {
        neutral: 'border-white/10 bg-white/[0.04] text-muted-foreground',
        blue: 'border-blue-300/20 bg-blue-400/10 text-blue-100',
        violet: 'border-violet-300/20 bg-violet-400/10 text-violet-100',
        rose: 'border-rose-300/20 bg-rose-400/10 text-rose-100',
        emerald: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
      },
      size: {
        sm: 'px-2.5 py-0.5 text-[11px]',
        md: 'px-3 py-1 text-xs',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'md',
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, tone, size, ...props },
  ref,
) {
  return <span ref={ref} className={cn(badgeVariants({ tone, size }), className)} {...props} />;
});
