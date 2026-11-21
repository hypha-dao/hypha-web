import * as React from 'react';
import { Construction, X } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';

/** A close button needs an accessible name, so the two props go together. */
type DismissProps =
  | {
      /** Shows a close button; the parent decides what closing does. */
      onDismiss: () => void;
      /** Accessible name of the close button. */
      dismissLabel: string;
    }
  | { onDismiss?: undefined; dismissLabel?: undefined };

export type FloatingNoticeProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'title'
> &
  DismissProps & {
    /** Short bold lead-in, shown before the message. Include its punctuation. */
    title?: React.ReactNode;
    /** `warning` adds soft warning colors. */
    variant?: 'neutral' | 'warning';
    /** Show the work-in-progress icon. Defaults to on for `warning`. */
    withIcon?: boolean;
    /** Optional action, for example a text link styled button. */
    action?: React.ReactNode;
  };

/**
 * A slim notice floating at the bottom centre of the viewport. It floats above
 * the page, so showing it never shifts the layout. Content is centred and the
 * text wraps to more lines only when it has to.
 */
const FloatingNotice = React.forwardRef<HTMLDivElement, FloatingNoticeProps>(
  (
    {
      className,
      title,
      variant = 'neutral',
      withIcon = variant === 'warning',
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
        // Narrow screens: one flex row. From `sm`: three columns, so the text
        // is centred in the notice and the actions stay at the right edge.
        'fixed bottom-4 left-1/2 z-[60] flex w-[92%] max-w-5xl -translate-x-1/2 items-center gap-2 rounded-xl border px-3 py-2 text-center text-xs text-foreground shadow-md sm:grid sm:grid-cols-[1fr_auto_1fr]',
        variant === 'warning'
          ? 'border-warning-7 bg-warning-2'
          : 'bg-background',
        className,
      )}
      {...props}
    >
      {/* Empty left column that balances the actions on the right. */}
      <span aria-hidden="true" className="hidden sm:block" />
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:flex-none">
        {withIcon ? (
          <Construction
            aria-hidden="true"
            className={cn(
              'size-4 shrink-0',
              variant === 'warning'
                ? 'text-warning-11'
                : 'text-muted-foreground',
            )}
          />
        ) : null}
        <p className="min-w-0">
          {title ? <span className="font-semibold">{title} </span> : null}
          {children}
        </p>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        {action}
        {onDismiss ? (
          <button
            type="button"
            aria-label={dismissLabel}
            onClick={onDismiss}
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  ),
);
FloatingNotice.displayName = 'FloatingNotice';

export { FloatingNotice };
