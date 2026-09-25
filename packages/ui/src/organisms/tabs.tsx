'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@hypha-platform/ui-utils';

interface TabsProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> {
  disabled?: boolean;
}

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  TabsProps
>(({ className, disabled, onValueChange, ...props }, ref) => {
  const handleValueChange = (value: string) => {
    if (!disabled && onValueChange) {
      onValueChange(value);
    }
  };

  return (
    <TabsPrimitive.Root
      ref={ref}
      className={cn(
        'tabs-root',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      onValueChange={handleValueChange}
      {...props}
    />
  );
});
Tabs.displayName = TabsPrimitive.Root.displayName;

export type TabsListProps = React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.List
> & {
  triggerVariant?: 'default' | 'ghost' | 'outlined' | 'switch';
};

/** Viewport for filter rows that must scroll on narrow screens. */
export const scrollableTabsListViewportClassName =
  'w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]';

/**
 * Shared letterforms for tab chrome — matches website controls:
 * 11px / 600 / uppercase / 0.12em tracking, square, no fill well.
 */
const tabsTriggerBaseClassName =
  'inline-flex items-center justify-center whitespace-nowrap rounded-none px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-[color,border-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

/** Active = accent hairline underline (space hue inside a space). */
const tabsTriggerUnderlineActive =
  'border-b border-transparent data-[state=active]:border-accent-9 data-[state=active]:text-foreground';

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, triggerVariant, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-start gap-0.5 rounded-none bg-transparent text-muted-foreground',
      /* switch kept as API alias — track fill removed; strip is flat like ghost */
      triggerVariant === 'switch' && 'gap-0.5 px-0',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export type ScrollableTabsListProps = TabsListProps & {
  viewportClassName?: string;
};

/**
 * Filter TabsList that scrolls horizontally inside the viewport
 * instead of expanding the page or clipping trailing tabs on mobile.
 */
const ScrollableTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  ScrollableTabsListProps
>(({ className, viewportClassName, ...props }, ref) => (
  <div className={cn(scrollableTabsListViewportClassName, viewportClassName)}>
    <TabsList
      ref={ref}
      className={cn('w-max max-w-none', className)}
      {...props}
    />
  </div>
));
ScrollableTabsList.displayName = 'ScrollableTabsList';

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    variant?: 'default' | 'ghost' | 'outlined' | 'switch';
  }
>(({ className, variant = 'default', ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    data-tabs-variant={variant}
    className={cn(
      tabsTriggerBaseClassName,
      (variant === 'ghost' || variant === 'default' || variant === 'switch') &&
        cn('bg-transparent shadow-none', tabsTriggerUnderlineActive),
      variant === 'outlined' &&
        cn(
          'mr-2 border border-border/70 bg-transparent shadow-none',
          'data-[state=active]:border-accent-9 data-[state=active]:text-foreground',
        ),
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, ScrollableTabsList, TabsTrigger, TabsContent };
