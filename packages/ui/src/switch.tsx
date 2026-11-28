'use client';

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';

import { cn } from '@hypha-platform/ui-utils';

const switchSizeClass = {
  default: {
    root: 'h-7 w-12',
    thumb:
      'top-1 left-1 size-5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
  },
  sm: {
    root: 'h-6 w-11',
    thumb:
      'top-0.5 left-0.5 size-5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
  },
} as const;

type SwitchProps = React.ComponentPropsWithoutRef<
  typeof SwitchPrimitives.Root
> & {
  size?: keyof typeof switchSizeClass;
};

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, size = 'default', ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-1 border-neutral-6 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent-9 data-[state=unchecked]:bg-input',
      switchSizeClass[size].root,
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none absolute block shrink-0 rounded-full bg-white shadow-sm ring-1 ring-black/15 transition-transform data-[state=checked]:bg-accent-contrast',
        switchSizeClass[size].thumb,
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
