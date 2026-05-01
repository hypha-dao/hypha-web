import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@hypha-platform/ui-utils';

/**
 * Consistent main-column rhythm for DHO `/@tab/*` pages (toolbar row → cards/lists).
 * Matches `Container` horizontal padding in `dho/[id]/layout` (content is full width of the container).
 */
export const dhoTabPageClass =
  'flex w-full min-w-0 flex-col gap-4 py-4' as const;

/** Toolbar + list column without vertical padding (use inside a {@link DhoTabPage} shell). */
export const dhoTabSectionClass = 'flex w-full min-w-0 flex-col gap-4' as const;

const toolbarStackClass = 'flex w-full min-w-0 flex-col gap-3' as const;

const listStackClass = 'w-full min-w-0 space-y-2' as const;

type SlotProps = {
  children: ReactNode;
  className?: string;
} & ComponentProps<'div'>;

export function DhoTabPage({ children, className, ...rest }: SlotProps) {
  return (
    <div className={cn(dhoTabPageClass, className)} {...rest}>
      {children}
    </div>
  );
}

/**
 * Section title row: `SectionFilter` (+ tabs/actions). Kept one tick looser than the
 * content stack so the title/search line can breathe.
 */
export function DhoTabToolbarStack({
  children,
  className,
  ...rest
}: SlotProps) {
  return (
    <div
      className={cn(toolbarStackClass, className)}
      data-testid="dho-tab-toolbar-stack"
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Primary card/list region below the toolbar (repeated pages, grid rows, etc.).
 */
export function DhoTabListStack({ children, className, ...rest }: SlotProps) {
  return (
    <div
      className={cn(listStackClass, className)}
      data-testid="dho-tab-list-stack"
      {...rest}
    >
      {children}
    </div>
  );
}

export function DhoTabSection({ children, className, ...rest }: SlotProps) {
  return (
    <div className={cn(dhoTabSectionClass, className)} {...rest}>
      {children}
    </div>
  );
}
