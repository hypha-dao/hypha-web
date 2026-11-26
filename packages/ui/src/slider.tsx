'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@hypha-platform/ui-utils';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    displayValue?: boolean;
    /** Accent follows space theme; ink is black/foreground for quiet chrome. */
    tone?: 'accent' | 'ink';
  }
>(
  (
    {
      className,
      displayValue = false,
      tone = 'accent',
      disabled,
      value,
      defaultValue,
      onValueChange,
      ...props
    },
    ref,
  ) => {
    const fillClass =
      tone === 'ink'
        ? 'bg-foreground'
        : 'bg-[color-mix(in_oklab,var(--space-accent,var(--color-accent-9))_92%,transparent)]';
    const thumbRingClass =
      tone === 'ink'
        ? 'ring-2 ring-foreground'
        : 'ring-2 ring-[var(--space-accent,var(--color-accent-9))]';
    const [internalValue, setInternalValue] = React.useState(
      () => defaultValue?.[0] ?? 0,
    );
    const isControlled = value !== undefined;
    const current = isControlled ? value[0] ?? 0 : internalValue;

    const handleSliderChange = (newValue: number[]) => {
      if (!isControlled) {
        setInternalValue(newValue[0] ?? 0);
      }
      onValueChange?.(newValue);
    };

    return (
      <div
        className={cn(
          'relative flex items-center w-full',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <SliderPrimitive.Root
          ref={ref}
          className={cn(
            'relative flex w-full touch-none select-none items-center',
            className,
          )}
          disabled={disabled}
          {...props}
          {...(isControlled
            ? { value, onValueChange: handleSliderChange }
            : {
                defaultValue: defaultValue ?? [internalValue],
                onValueChange: handleSliderChange,
              })}
        >
          {/*
          Track: same muted shell as proposal voting. Fill + thumb use
          `--space-accent` when mirrored to :root (DHO), else theme accent-9.
        */}
          <SliderPrimitive.Track
            className={cn(
              'relative h-1.5 w-full grow overflow-hidden rounded-none',
              'bg-muted ring-1 ring-inset ring-border/60',
            )}
          >
            <SliderPrimitive.Range
              className={cn('absolute h-full rounded-none', fillClass)}
            />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className={cn(
              'block size-3.5 rounded-none border-2 border-background',
              'bg-background shadow-none',
              thumbRingClass,
              'ring-offset-1 ring-offset-background',
              'transition-[transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          />
        </SliderPrimitive.Root>

        {displayValue && (
          <span
            className={cn('text-1 ml-4 tabular-nums', disabled && 'opacity-50')}
          >
            {Math.round(current)}%
          </span>
        )}
      </div>
    );
  },
);

Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
