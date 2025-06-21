import { Text } from '@radix-ui/themes';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import * as React from 'react';
import { cn } from '@hypha-platform/ui-utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Skeleton } from '../skeleton';

const amountVariants = cva('', {
  variants: {
    variant: {
      default: 'text-3',
      ghost: 'text-gray-500 text-1',
    },
    size: {
      default: 'text-lg',
      lg: 'text-lg',
      sm: 'text-sm',
      xs: 'text-xs',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export interface AmountProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof amountVariants> {
  value: number | undefined;
  withUsdSymbol?: boolean;
  children?: React.ReactNode;
  className?: string;
  isLoading?: boolean;
}

function Amount({
  className,
  variant,
  size,
  withUsdSymbol,
  children,
  value,
  isLoading,
}: AmountProps) {
  return (
    <div className={className}>
      <Skeleton width="80px" height="16px" loading={isLoading}>
        <Text className={cn(amountVariants({ variant, size }), className)}>
          {withUsdSymbol ? `$ ` : null}
          {value ? formatCurrencyValue(value) : 0} {children}
        </Text>
      </Skeleton>
    </div>
  );
}

export { Amount, amountVariants };
