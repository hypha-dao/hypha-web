import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@hypha-platform/ui-utils';

import { Skeleton } from './skeleton';

const parameters = {
  size: {
    1: {
      text: 'text-1',
      px: 'px-[0.6rem]',
      py: 'py-[0.2rem]',
    },
    2: {
      text: 'text-1',
      px: 'px-2',
      py: 'py-1',
    },
    3: {
      text: 'text-2',
      px: 'px-[1rem]',
      py: 'py-1',
    },
  },
};

const badgeVariants = cva(
  'inline-flex items-center rounded-lg border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-medium transition-colors',
  {
    variants: {
      size: {
        1: [
          parameters.size[1].text,
          parameters.size[1].px,
          parameters.size[1].py,
        ],
        2: [
          parameters.size[2].text,
          parameters.size[2].px,
          parameters.size[2].py,
        ],
        3: [
          parameters.size[3].text,
          parameters.size[3].px,
          parameters.size[3].py,
        ],
      },
      variant: {
        solid: 'border-transparent',
        soft: 'border-transparent',
        outline: 'bg-transparent',
        surface: '',
      },
      colorVariant: {
        accent: '',
        error: '',
        warn: '',
        neutral: '',
        success: '',
      },
    },
    compoundVariants: [
      // Solid variants
      {
        variant: 'solid',
        colorVariant: 'accent',
        className: 'bg-accent-9 text-accent-contrast hover:bg-accent-10',
      },
      {
        variant: 'solid',
        colorVariant: 'success',
        className: 'bg-success-9 text-success-contrast hover:bg-success-10',
      },
      {
        variant: 'solid',
        colorVariant: 'error',
        className: 'bg-error-9 text-error-contrast hover:bg-error-10',
      },
      {
        variant: 'solid',
        colorVariant: 'warn',
        className: 'bg-warning-9 text-warning-contrast hover:bg-warning-10',
      },
      {
        variant: 'solid',
        colorVariant: 'neutral',
        className: 'bg-neutral-9 text-neutral-contrast hover:bg-neutral-10',
      },
      // Soft variants
      {
        variant: 'soft',
        colorVariant: 'accent',
        className: 'bg-accent-3 text-accent-11 hover:bg-accent-4',
      },
      {
        variant: 'soft',
        colorVariant: 'success',
        className: 'bg-success-3 text-success-11 hover:bg-success-4',
      },
      {
        variant: 'soft',
        colorVariant: 'error',
        className: 'bg-error-3 text-error-11 hover:bg-error-4',
      },
      {
        variant: 'soft',
        colorVariant: 'warn',
        className: 'bg-warning-3 text-warning-11 hover:bg-warning-4',
      },
      {
        variant: 'soft',
        colorVariant: 'neutral',
        className: 'bg-neutral-3 text-neutral-11 hover:bg-neutral-4',
      },
      // Outline variants
      {
        variant: 'outline',
        colorVariant: 'accent',
        className:
          'border-accent-8 text-accent-11 hover:border-accent-9 hover:bg-accent-2',
      },
      {
        variant: 'outline',
        colorVariant: 'success',
        className:
          'border-success-8 text-success-11 hover:border-success-9 hover:bg-success-2',
      },
      {
        variant: 'outline',
        colorVariant: 'error',
        className:
          'border-error-8 text-error-11 hover:border-error-9 hover:bg-error-2',
      },
      {
        variant: 'outline',
        colorVariant: 'warn',
        className:
          'border-warning-8 text-warning-11 hover:border-warning-9 hover:bg-warning-2',
      },
      {
        variant: 'outline',
        colorVariant: 'neutral',
        className:
          'border-neutral-8 text-neutral-11 hover:border-neutral-9 hover:bg-neutral-2',
      },
      // Surface variants
      {
        variant: 'surface',
        colorVariant: 'accent',
        className:
          'border-accent-7 bg-accent-2 text-accent-11 hover:bg-accent-3',
      },
      {
        variant: 'surface',
        colorVariant: 'success',
        className:
          'border-success-7 bg-success-2 text-success-11 hover:bg-success-3',
      },
      {
        variant: 'surface',
        colorVariant: 'error',
        className: 'border-error-7 bg-error-2 text-error-11 hover:bg-error-3',
      },
      {
        variant: 'surface',
        colorVariant: 'warn',
        className:
          'border-warning-7 bg-warning-2 text-warning-11 hover:bg-warning-3',
      },
      {
        variant: 'surface',
        colorVariant: 'neutral',
        className:
          'border-neutral-7 bg-neutral-2 text-neutral-11 hover:bg-neutral-3',
      },
    ],
    defaultVariants: {
      size: 2,
      variant: 'solid',
      colorVariant: 'neutral',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  isLoading?: boolean | undefined;
}

function Badge({
  className,
  size,
  variant,
  colorVariant,
  isLoading = false,
  ...props
}: BadgeProps) {
  return (
    <Skeleton width="50px" height="16px" loading={isLoading}>
      <div
        className={cn(
          badgeVariants({ size, variant, colorVariant }),
          className,
        )}
        {...props}
      />
    </Skeleton>
  );
}

export { Badge, badgeVariants, parameters };
