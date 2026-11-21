import * as React from 'react';
import { AlertTriangle, X } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

export interface FloatingNoticeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Short lead-in, shown in bold before the message and followed by a colon. */
  title?: React.ReactNode;
  /** `warning` adds warning colors and an alert icon; `neutral` is plain. */
  variant?: 'neutral' | 'warning';
  /** Optional action, for example a `Button`. */
  action?: React.ReactNode;
  /** When set, a close button is shown; the parent decides what closing does. */
  onDismiss?: () => void;
  /** Accessible name of the close button (required to be useful with onDismiss). */
  dismissLabel?: string;
}

/**
 * A one-line notice floating at the bottom centre of the viewport (about 90%
 * wide, wrapping to more lines only when the text needs it). It floats above
 * the page, so showing it never shifts the layout.
 */
const FloatingNotice = React.forwardRef<HTMLDivElement, FloatingNoticeProps>(
  (
    {
      className,
      title,
      variant = 'neutral',
      action,
      onDismiss,
      dismissLabel,
      children,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-4 left-1/2 z-[60] flex w-[90%] max-w-3xl -translate-x-1/2 items-center gap-3 border p-3 text-left text-sm text-foreground shadow-lg',
        variant === 'warning'
          ? 'border-warning-7 bg-warning-2'
          : 'bg-background',
        className,
      )}
      {...props}
    >
      {variant === 'warning' ? (
        <AlertTriangle
          aria-hidden="true"
          className="size-5 shrink-0 text-warning-11"
        />
      ) : null}
      <p className="min-w-0 flex-1">
        {title ? <span className="font-semibold">{title}: </span> : null}
        {children}
      </p>
      {action ? <div className="shrink-0">{action}</div> : null}
      {onDismiss ? (
        <button
          type="button"
          aria-label={dismissLabel}
          onClick={onDismiss}
          className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  ),
);
FloatingNotice.displayName = 'FloatingNotice';

export { FloatingNotice };
