import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@hypha-platform/ui-utils';

const buttonVariants = cva(
  'cursor-pointer rounded-none inline-flex items-center justify-center gap-2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em] ring-offset-background transition-[color,border-color,background-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: '',
        outline: 'border bg-transparent',
        link: 'normal-case tracking-normal text-sm font-medium underline-offset-4 hover:underline bg-transparent',
        ghost: 'bg-transparent',
      },
      size: {
        /** Standard actions — 48px, matching the website control. */
        default: 'min-h-12 px-5',
        /** Compact toolbar / auxiliary actions. */
        sm: 'min-h-8 px-3',
        /** Primary emphasis (hero / dialog primary). Same letterforms, wider. */
        lg: 'min-h-12 px-8',
        icon: 'h-10 min-h-10 min-w-10 shrink-0 rounded-none p-0 normal-case tracking-normal [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:stroke-[1.25]',
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
          'hypha-control-outline border-foreground/15 text-foreground hover:border-foreground/40 hover:bg-foreground/5',
      },
      {
        variant: 'outline',
        colorVariant: 'neutral',
        className:
          'border-foreground/15 bg-transparent text-foreground hover:border-foreground/40 hover:bg-foreground/5',
      },
      {
        variant: 'outline',
        colorVariant: 'error',
        className:
          'border-error-9 text-error-9 hover:border-error-10 hover:bg-error-3',
      },
      {
        variant: 'outline',
        colorVariant: 'success',
        className:
          'border-success-10 text-success-11 hover:border-success-11 hover:bg-success-3',
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
