import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@hypha-platform/ui-utils';

const buttonVariants = cva(
  'cursor-pointer rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold ring-offset-background transition-[color,box-shadow,transform,background-color,--tw-ring-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: '',
        outline:
          /* ring-2 reserved so hover highlight does not shift layout */
          'border bg-transparent shadow-sm ring-2 ring-transparent hover:border-border active:shadow-sm',
        link: 'underline-offset-4 hover:underline bg-transparent font-medium',
        ghost: 'bg-transparent font-medium',
      },
      size: {
        /** Standard actions — matches modal/footer CTAs (touch-friendly min height). */
        default: 'min-h-10 px-5 py-2',
        /** Compact toolbar / auxiliary actions. */
        sm: 'min-h-8 px-3 py-1.5 text-xs',
        /** Primary emphasis (hero / dialog primary). */
        lg: 'min-h-11 px-8 py-2.5 text-base',
        icon: 'h-10 min-h-10 min-w-10 shrink-0 p-0',
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
        className:
          'bg-accent-9 text-accent-contrast shadow-sm hover:bg-accent-10 active:scale-[0.99] active:shadow-sm dark:shadow-black/20',
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
          /* Outline hover: emphasize border + ring — no solid fill (matches status chips) */
          'border-accent-8 text-accent-11 hover:border-accent-10 hover:text-foreground hover:ring-accent-10/75 active:scale-[0.99]',
      },
      {
        variant: 'outline',
        colorVariant: 'neutral',
        className:
          'border-neutral-9 bg-neutral-1 text-neutral-12 hover:border-neutral-11 hover:text-foreground hover:ring-neutral-10/70',
      },
      {
        variant: 'outline',
        colorVariant: 'error',
        className:
          'border-error-9 text-error-9 hover:border-error-10 hover:text-foreground hover:ring-error-10/75',
      },
      {
        variant: 'outline',
        colorVariant: 'success',
        className:
          'border-success-10 text-success-11 hover:border-success-11 hover:text-foreground hover:ring-success-10/75',
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
        className: 'text-accent-11 hover:bg-accent-3 hover:text-foreground',
      },
      {
        variant: 'ghost',
        colorVariant: 'neutral',
        className: 'text-neutral-11 hover:bg-neutral-3 hover:text-foreground',
      },
      {
        variant: 'ghost',
        colorVariant: 'error',
        className: 'text-error-11 hover:bg-error-3 hover:text-foreground',
      },
      {
        variant: 'ghost',
        colorVariant: 'success',
        className: 'text-success-11 hover:bg-success-3 hover:text-foreground',
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
