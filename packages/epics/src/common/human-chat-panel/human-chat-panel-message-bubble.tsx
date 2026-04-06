'use client';

import { useTranslations } from 'next-intl';
import { Smile, Reply, MoreHorizontal } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../people/components/person-avatar';

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
    avatarUrl?: string;
    timestamp?: Date;
    reactions?: Reaction[];
    /** Rich reply: quoted context above the new text */
    replyTo?: {
      authorLabel: string;
      /** When omitted, UI shows “original unavailable” */
      excerpt?: string;
    };
  };
  isStreaming?: boolean;
  /** When set, Reply is enabled (omit for synthetic messages like welcome). */
  onReply?: () => void;
};

/**
 * Discord-style relative timestamp: browser locale + user's timezone (default).
 * Today: time only; yesterday: label + time; older: localized date + time.
 */
function formatTimestamp(
  date: Date,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfMessageDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfMessageDay.getTime()) /
      (24 * 60 * 60 * 1000),
  );

  const timeStr = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (dayDiff === 0) {
    return t('timestampToday', { time: timeStr });
  }
  if (dayDiff === 1) {
    return t('timestampYesterday', { time: timeStr });
  }

  const dateStr = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
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
  onReply,
}: HumanChatPanelMessageBubbleProps) {
  const t = useTranslations('HumanChatPanel');

  // TODO: Handle non-text parts (file attachments, tool results, etc.)
  const textParts =
    message.parts?.filter(
      (p): p is { type: 'text'; text: string } => p.type === 'text',
    ) ?? [];
  const textContent = textParts.map((p) => p.text).join('');

  const senderName = message.senderName ?? t('you');
  const timestamp = message.timestamp
    ? formatTimestamp(message.timestamp, t)
    : undefined;
  const reactions = message.reactions ?? [];
  const replyTo = message.replyTo;
  const canReply = Boolean(onReply);

  return (
    <div
      data-testid="chat-message"
      className="group relative flex gap-3 px-1 py-1 hover:bg-muted/30 focus-within:bg-muted/30 rounded-md transition-colors"
    >
      {/* Avatar */}
      <div className="mt-0.5 shrink-0" data-testid="chat-message-avatar">
        <PersonAvatar
          size="sm"
          avatarSrc={message.avatarUrl}
          userName={senderName}
        />
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

        {replyTo && (
          <div
            data-testid="chat-message-reply-context"
            className="mt-1 min-w-0 border-l-2 border-primary/40 pl-2 text-xs text-muted-foreground"
          >
            <p className="min-w-0 truncate">
              <span className="font-medium text-foreground">
                {replyTo.authorLabel}
              </span>
              {replyTo.excerpt != null && replyTo.excerpt !== '' ? (
                <>
                  <span className="text-muted-foreground"> — </span>
                  <span className="text-muted-foreground">
                    {replyTo.excerpt}
                  </span>
                </>
              ) : (
                <span className="ml-1 italic">
                  {t('replyOriginalUnavailable')}
                </span>
              )}
            </p>
          </div>
        )}

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

      {/* Hover / focus-within action bar */}
      <div className="absolute right-2 top-0 -translate-y-1/2 flex items-center gap-0.5 rounded-md border border-border bg-background-2 px-1 py-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shadow-sm">
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
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:pointer-events-none disabled:opacity-40"
          aria-label={t('replyButton')}
          disabled={!canReply}
          aria-disabled={!canReply}
          onClick={onReply}
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
