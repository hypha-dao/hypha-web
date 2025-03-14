'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@hypha-platform/lib/utils';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    displayValue?: boolean;
  }
>(({ className, displayValue = false, disabled, ...props }, ref) => {
  const [value, setValue] = React.useState(
    (props.defaultValue && props.defaultValue[0]) || 0,
  );

  const handleSliderChange = (newValue: number[]) => {
    setValue(newValue[0]);
  };

  return (
    <div
      className={cn(
        'relative flex items-center w-full',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <SliderPrimitive.Root
        ref={ref}
        className={cn(
          'relative flex w-full touch-none select-none items-center',
          className,
        )}
        value={[value]}
        onValueChange={handleSliderChange}
        disabled={disabled}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-transparent border border-neutral-9">
          <SliderPrimitive.Range className="absolute h-full bg-accent-9" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-3 w-3 rounded-full border border-primary/50 bg-foreground shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
      </SliderPrimitive.Root>

      {displayValue && (
        <span className={cn('ml-4 text-1', disabled && 'opacity-50')}>
          {Math.round(value)}%
        </span>
      )}
    </div>
  );
});

Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
