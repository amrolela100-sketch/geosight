import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '../lib/cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-glow hover:-translate-y-0.5 hover:opacity-95',
        secondary:
          'border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08] hover:border-white/[0.18]',
        destructive:
          'border border-destructive/40 text-destructive hover:bg-destructive/10',
        ghost:
          'text-muted-foreground hover:bg-white/[0.05] hover:text-white',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  pending?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, pending, disabled, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  // Slot requires a single React child, so when `asChild` we pass the consumer's
  // element through unchanged and skip the spinner adornment.
  const inner =
    asChild ? (
      children
    ) : (
      <>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {children}
      </>
    );
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || pending}
      data-pending={pending ? 'true' : undefined}
      {...props}
    >
      {inner}
    </Comp>
  );
});
