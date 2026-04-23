'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@hypha-platform/ui-utils';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    displayValue?: boolean;
  }
>(
  (
    {
      className,
      displayValue = false,
      disabled,
      value,
      defaultValue,
      onValueChange,
      ...props
    },
    ref,
  ) => {
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
          Track / fill aligned with ProposalDetails `ProgressLine` (voting details):
          muted track + inset ring, primary/accent fill, clear thumb on the rail.
        */}
          <SliderPrimitive.Track
            className={cn(
              'relative h-3 w-full grow overflow-hidden rounded-full',
              'bg-muted/80 ring-1 ring-inset ring-border/60',
            )}
          >
            <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className={cn(
              'block h-3.5 w-3.5 rounded-full border-2 border-background',
              'bg-foreground shadow-md ring-1 ring-border/50',
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
