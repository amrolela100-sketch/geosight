import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '../lib/cn';

export const editorialEyebrowVariants = cva('eyebrow-track', {
  variants: {
    tone: {
      faint: '',
      strong: 'eyebrow-track--strong',
      coral: 'eyebrow-track--coral',
    },
  },
  defaultVariants: { tone: 'faint' },
});

export interface EditorialEyebrowProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof editorialEyebrowVariants> {}

export const EditorialEyebrow = forwardRef<HTMLSpanElement, EditorialEyebrowProps>(
  function EditorialEyebrow({ className, tone, ...props }, ref) {
    return (
      <span
        ref={ref}
        className={cn(editorialEyebrowVariants({ tone }), className)}
        {...props}
      />
    );
  },
);
