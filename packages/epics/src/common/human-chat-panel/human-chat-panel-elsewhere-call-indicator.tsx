'use client';

import { useState } from 'react';
import { Phone } from 'lucide-react';
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

/** Space logo, resolved the same way as the recent-spaces sidebar (`ai-left-panel.tsx`) — the
 * caller batch-fetches space records and resolves this; `null`/`undefined` falls back to the
 * first-letter avatar below. */
export type CallElsewhereEntryWithAvatar = CallElsewhereEntry & {
  avatarUrl?: string | null;
};

export type HumanChatPanelElsewhereCallIndicatorProps = {
  entries: CallElsewhereEntryWithAvatar[];
  onSelect: (entry: CallElsewhereEntry) => void;
  label: string;
};

function initialFor(title: string): string {
  return title.trim().slice(0, 1).toUpperCase() || '?';
}

/** Fixed square (not `min-w` + padding) so the circular image clip lines up exactly with
 * the button's own edges — a non-square box left the `bg-accent` fallback color peeking
 * out past the image's rounded corners once a real avatar loaded in. */
const SINGLE_AVATAR_CLASS =
  'relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium text-accent-foreground ring-2 ring-background transition-colors';
const AVATAR_FALLBACK_BG_CLASS = 'bg-accent hover:bg-accent/80';
const COUNT_BADGE_CLASS =
  'relative flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-accent-foreground ring-2 ring-background transition-colors hover:bg-accent/80';

/**
 * Clips just the image/letter to a circle — deliberately *not* on the outer button
 * (`AVATAR_CLASS`), since `LiveCallBadge` below is a sibling positioned outside the
 * button's own box; an `overflow-hidden` there would clip the badge (same bug fixed
 * for the top-nav trigger in `panel-wrap-layout.tsx`).
 */
function EntryAvatarContent({
  entry,
}: {
  entry: CallElsewhereEntryWithAvatar;
}) {
  if (entry.avatarUrl) {
    return (
      <span className="block h-full w-full overflow-hidden rounded-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={entry.avatarUrl}
          alt={entry.title}
          className="block h-full w-full object-cover object-center"
        />
      </span>
    );
  }
  return <>{initialFor(entry.title)}</>;
}

/**
 * Constant-pulse call badge signaling "this is a live call right now" — a phone glyph
 * (not just a generic dot) on the theme's `success` scale, matching the sidebar trigger
 * badge and the app's other "active" indicators (e.g. `bank-account-card.tsx`).
 */
function LiveCallBadge() {
  return (
    <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-9 opacity-60" />
      {/* h-4.5/w-4.5 isn't a valid utility here — this theme's `--spacing-N` scale
          (packages/ui-utils/src/global.css) only defines whole-number tokens past
          Tailwind's built-in 3.5, so arbitrary values are used for the in-between size. */}
      <span className="relative flex h-[18px] w-[18px] items-center justify-center rounded-full bg-success-9 ring-2 ring-background">
        <Phone className="h-3 w-3 text-white" strokeWidth={2.5} />
      </span>
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
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);

  if (entries.length === 0) return null;

  const handleSelect = (entry: CallElsewhereEntry) => {
    setPendingRoomId(entry.roomId);
    onSelect(entry);
  };

  const [entry] = entries;
  if (entries.length === 1 && entry) {
    const pending = pendingRoomId === entry.roomId;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => handleSelect(entry)}
            disabled={pending}
            className={[
              SINGLE_AVATAR_CLASS,
              entry.avatarUrl ? '' : AVATAR_FALLBACK_BG_CLASS,
              pending ? 'opacity-60' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={label}
          >
            <EntryAvatarContent entry={entry} />
            <LiveCallBadge />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{entry.title}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={COUNT_BADGE_CLASS} aria-label={label}>
          {entries.length}
          <LiveCallBadge />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {entries.map((entry) => (
          <DropdownMenuItem
            key={entry.roomId}
            disabled={pendingRoomId === entry.roomId}
            onSelect={() => handleSelect(entry)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={[
                  'relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-accent-foreground',
                  entry.avatarUrl ? '' : 'bg-accent',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <EntryAvatarContent entry={entry} />
              </span>
              <span className="truncate">
                {entry.title}
                {pendingRoomId === entry.roomId ? '…' : ''}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
