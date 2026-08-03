'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@hypha-platform/ui';
import type { CallElsewhereEntry } from './use-call-membership-registry';

export type HumanChatPanelElsewhereCallIndicatorProps = {
  entries: CallElsewhereEntry[];
  onSelect: (entry: CallElsewhereEntry) => void;
  label: string;
};

function initialFor(title: string): string {
  return title.trim().slice(0, 1).toUpperCase() || '?';
}

const AVATAR_CLASS =
  'relative flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-accent-foreground ring-2 ring-background transition-colors hover:bg-accent/80';

/** Constant-pulse dot signaling "this is live right now," matching the sidebar trigger badge. */
function LiveDot() {
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  );
}

/**
 * Shows an avatar (single call elsewhere) or a stacked count with a menu (multiple),
 * so the user can jump to whichever other active call they want without losing
 * the one they're currently viewing. See #2424.
 */
export function HumanChatPanelElsewhereCallIndicator({
  entries,
  onSelect,
  label,
}: HumanChatPanelElsewhereCallIndicatorProps) {
  if (entries.length === 0) return null;

  const [entry] = entries;
  if (entries.length === 1 && entry) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect(entry)}
            className={AVATAR_CLASS}
            aria-label={label}
          >
            {initialFor(entry.title)}
            <LiveDot />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{entry.title}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={AVATAR_CLASS} aria-label={label}>
          {entries.length}
          <LiveDot />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {entries.map((entry) => (
          <DropdownMenuItem key={entry.roomId} onSelect={() => onSelect(entry)}>
            {entry.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
