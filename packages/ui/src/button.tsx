import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@hypha-platform/ui-utils';

const buttonVariants = cva(
  'cursor-pointer rounded inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: '',
        outline: 'border bg-transparent',
        link: 'underline-offset-4 hover:underline bg-transparent',
        ghost: 'bg-transparent',
      },
      size: {
        default: 'h-6 font-medium px-3',
        sm: 'h-4 px-3',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
      colorVariant: {
        accent: '',
        neutral: '',
        error: '',
        success: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      colorVariant: 'accent',
    },
    compoundVariants: [
      {
        variant: 'default',
        colorVariant: 'accent',
        className: 'bg-accent-9 text-accent-contrast hover:bg-accent-10',
      },
      {
        variant: 'default',
        colorVariant: 'neutral',
        className: 'bg-neutral-9 text-neutral-contrast hover:bg-neutral-10',
      },
      {
        variant: 'default',
        colorVariant: 'error',
        className: 'bg-error-9 text-error-contrast hover:bg-error-10',
      },
      {
        variant: 'default',
        colorVariant: 'success',
        className: 'bg-success-9 text-success-contrast hover:bg-success-10',
      },
      {
        variant: 'outline',
        colorVariant: 'accent',
        className:
          'border-accent-9 text-accent-11 hover:bg-accent-2 hover:text-accent-12',
      },
      {
        variant: 'outline',
        colorVariant: 'neutral',
        className:
          'border-neutral-9 text-secondary-foreground bg-neutral-1 hover:text-neutral-12',
      },
      {
        variant: 'outline',
        colorVariant: 'error',
        className:
          'border-error-9 text-error-9 hover:bg-error-2 hover:text-error-11',
      },
      {
        variant: 'outline',
        colorVariant: 'success',
        className:
          'border-success-11 text-success-11 hover:bg-success-2 hover:text-success-12',
      },
      {
        variant: 'link',
        colorVariant: 'accent',
        className: 'text-accent-9 hover:text-accent-10',
      },
      {
        variant: 'link',
        colorVariant: 'neutral',
        className: 'text-neutral-9 hover:text-neutral-10',
      },
      {
        variant: 'link',
        colorVariant: 'error',
        className: 'text-error-9 hover:text-error-10',
      },
      {
        variant: 'link',
        colorVariant: 'success',
        className: 'text-success-9 hover:text-success-10',
      },
      {
        variant: 'ghost',
        colorVariant: 'accent',
        className: 'text-accent-11 hover:bg-accent-3 hover:text-accent-12',
      },
      {
        variant: 'ghost',
        colorVariant: 'neutral',
        className: 'text-neutral-11 hover:bg-neutral-3 hover:text-neutral-12',
      },
      {
        variant: 'ghost',
        colorVariant: 'error',
        className: 'text-error-11 hover:bg-error-3 hover:text-error-12',
      },
      {
        variant: 'ghost',
        colorVariant: 'success',
        className: 'text-success-11 hover:bg-success-3 hover:text-success-12',
      },
    ],
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const { colorVariant, ...rest } = props;
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, colorVariant }),
          className,
        )}
        type="button"
        ref={ref}
        {...rest}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
