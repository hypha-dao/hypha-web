import * as React from 'react';

import { cn } from '@hypha-platform/ui-utils';

export interface FloatingNoticeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  /** Optional action, for example a `Button`. */
  action?: React.ReactNode;
}

/**
 * A notice pinned to the bottom of the viewport (bottom-right on wider
 * screens). It floats above the page, so showing it never shifts the layout.
 * Not dismissible by itself: render it only while the message applies.
 */
const FloatingNotice = React.forwardRef<HTMLDivElement, FloatingNoticeProps>(
  ({ className, title, action, children, ...props }, ref) => (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-x-4 bottom-4 z-[60] flex flex-col gap-3 border bg-background p-4 text-sm text-foreground shadow-lg sm:left-auto sm:right-4 sm:max-w-sm',
        className,
      )}
      {...props}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className="text-muted-foreground">{children}</div>
      {action ? <div className="flex justify-end">{action}</div> : null}
    </div>
  ),
);
FloatingNotice.displayName = 'FloatingNotice';

export { FloatingNotice };
