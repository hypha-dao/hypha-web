'use client';

import { useTranslations } from 'next-intl';
import { Smile, Reply, MoreHorizontal } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';

type Reaction = {
  emoji: string;
  count: number;
};

type UIMessagePart =
  | { type: 'text'; text: string }
  | { type: string; [k: string]: unknown };

type HumanChatPanelMessageBubbleProps = {
  message: {
    id: string;
    role: 'user' | 'member';
    parts?: UIMessagePart[];
    senderName?: string;
    timestamp?: Date;
    reactions?: Reaction[];
  };
  isStreaming?: boolean;
};

/**
 * Generate a deterministic hue from a string (for avatar background color).
 */
function stringToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

/**
 * Get initials from a name (up to 2 characters).
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]?.charAt(0).toUpperCase() ?? '';
  return (
    (parts[0]?.charAt(0) ?? '') + (parts[1]?.charAt(0) ?? '')
  ).toUpperCase();
}

/**
 * Format a timestamp for display.
 */
function formatTimestamp(
  date: Date,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (isToday) return t('timestampToday', { time: timeStr });

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return t('timestampYesterday', { time: timeStr });
  }

  const dateStr = date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
  return t('timestampDate', { date: dateStr, time: timeStr });
}

/**
 * Render text content with @mentions highlighted.
 */
function renderTextWithMentions(text: string): React.ReactNode[] {
  const mentionRegex = /@([\w\s]+?)(?=\s|$|[.,!?;:])/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={match.index}
        className="bg-primary/20 text-primary rounded px-1 font-medium"
      >
        @{match[1]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function HumanChatPanelMessageBubble({
  message,
  isStreaming,
}: HumanChatPanelMessageBubbleProps) {
  const t = useTranslations('HumanChatPanel');

  const textParts =
    message.parts?.filter(
      (p): p is { type: 'text'; text: string } => p.type === 'text',
    ) ?? [];
  const textContent = textParts.map((p) => p.text).join('');

  const senderName = message.senderName ?? t('you');
  const hue = stringToHue(senderName);
  const initials = getInitials(senderName);
  const timestamp = message.timestamp
    ? formatTimestamp(message.timestamp, t)
    : undefined;
  const reactions = message.reactions ?? [];

  return (
    <div
      data-testid="chat-message"
      className="group relative flex gap-3 px-1 py-1 hover:bg-muted/30 rounded-md transition-colors"
    >
      {/* Avatar */}
      <div
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-xs font-semibold"
        style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}
      >
        {initials}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Name + Timestamp */}
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm text-foreground">
            {senderName}
          </span>
          {timestamp && (
            <span className="text-xs text-muted-foreground">{timestamp}</span>
          )}
        </div>

        {/* Message text */}
        {textContent && (
          <p
            data-testid="chat-message-body"
            className="mt-0.5 text-sm leading-relaxed text-foreground"
          >
            {renderTextWithMentions(textContent)}
          </p>
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <span className="mt-1 inline-flex items-center gap-0.5">
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary" />
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary [animation-delay:0.2s]" />
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary [animation-delay:0.4s]" />
          </span>
        )}

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {reactions.map((reaction, idx) => (
              <span
                key={`${reaction.emoji}-${idx}`}
                className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2 py-0.5 text-xs"
              >
                <span>{reaction.emoji}</span>
                <span className="text-muted-foreground">{reaction.count}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Hover action bar */}
      <div className="absolute right-2 top-0 -translate-y-1/2 flex items-center gap-0.5 rounded-md border border-border bg-background-2 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={t('reactButton')}
          disabled
          aria-disabled
        >
          <Smile className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={t('replyButton')}
          disabled
          aria-disabled
        >
          <Reply className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={t('moreButton')}
          disabled
          aria-disabled
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
