'use client';

import { cn } from '@hypha-platform/ui-utils';

type HumanChatPanelDateSeparatorProps = {
  label: string;
  className?: string;
};

/** Discord-style horizontal rule with centered date label. */
export function HumanChatPanelDateSeparator({
  label,
  className,
}: HumanChatPanelDateSeparatorProps) {
  return (
    <div
      className={cn(
        'relative my-1 flex min-h-[28px] w-full items-center py-2',
        className,
      )}
      role="separator"
      aria-label={label}
    >
      <div className="h-px flex-1 bg-border" aria-hidden />
      <span className="shrink-0 px-3 text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}
