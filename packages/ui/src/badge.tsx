import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@hypha-platform/ui-utils';

import { Skeleton } from './skeleton';

const badgeVariants = cva(
  'inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        positive: 'border-emerald-300 bg-green-500 text-green-500 bg-opacity-5',
        warning: 'border-amber-400 bg-orange-400 text-orange-400 bg-opacity-5',
        outline: 'text-foreground',
        action:
          'text-white rounded-lg bg-action hover:bg-action-foreground w-fit',
        actionOutline:
          'bg-action bg-opacity-20 border-blue-500/90 text-action-light',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  isLoading?: boolean | undefined;
}

function Badge({
  className,
  variant,
  isLoading = false,
  ...props
}: BadgeProps) {
  return (
    <Skeleton width="50px" height="16px" loading={isLoading}>
      <div className={cn(badgeVariants({ variant }), className)} {...props} />
    </Skeleton>
  );
}

export { Badge, badgeVariants };
