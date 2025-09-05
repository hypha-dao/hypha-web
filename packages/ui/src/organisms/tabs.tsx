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

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    triggerVariant?: 'default' | 'ghost' | 'outlined' | 'switch';
  }
>(({ className, triggerVariant, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-md text-muted-foreground',
      triggerVariant === 'switch' && 'bg-neutral-3 px-1 rounded-lg',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    variant?: 'default' | 'ghost' | 'outlined' | 'switch';
  }
>(({ className, variant = 'default', ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
      variant === 'ghost' &&
        'bg-transparent border-b-2 border-primary-foreground data-[state=active]:border-blue-500 data-[state=active]:text-secondary-foreground opacity-100',
      variant === 'default' &&
        'data-[state=active]:bg-background rounded-lg data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      variant === 'outlined' &&
        'mr-2 rounded-lg border data-[state=active]:bg-secondary-foreground data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm',
      variant === 'switch' &&
        'bg-neutral-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
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
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
