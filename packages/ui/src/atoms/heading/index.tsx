import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

const headingVariants = cva('m-0 [font-family:var(--font-family-text)]', {
  variants: {
    size: {
      '1': 'text-1 tracking-normal',
      '2': 'text-2 tracking-normal',
      '3': 'text-3 tracking-normal',
      '4': 'text-4 tracking-tight',
      '5': 'text-5 tracking-tight',
      '6': 'text-6 tracking-tight',
      '7': 'text-7 tracking-tight',
      '8': 'text-8 tracking-tight',
      '9': 'text-9 tracking-tight',
    },
    weight: {
      regular: 'font-normal',
      medium: 'font-medium',
      bold: 'font-bold',
    },
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    },
    color: {
      primary: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
    },
  },
  defaultVariants: {
    size: '1',
    weight: 'medium',
    align: 'left',
    color: 'primary',
  },
});

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  asChild?: boolean;
  size?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
  color?: 'primary' | 'secondary';
  align?: 'left' | 'center' | 'right';
  weight?: 'regular' | 'medium' | 'bold';
}

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  (
    {
      className,
      size,
      weight,
      align,
      color,
      asChild = false,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp
        className={headingVariants({ size, weight, align, color, className })}
        ref={ref}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);

Heading.displayName = 'Heading';

export { Heading, headingVariants };
