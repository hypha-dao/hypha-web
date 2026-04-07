'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Smile, SmilePlus, Reply, MoreHorizontal } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../people/components/person-avatar';

import { HumanChatPanelEmojiPicker } from './human-chat-panel-emoji-picker';

type Reaction = {
  emoji: string;
  count: number;
  includesCurrentUser?: boolean;
};

type UIMessagePart =
  | { type: 'text'; text: string }
  | { type: string; [k: string]: unknown };

type HumanChatPanelMessageBubbleProps = {
  message: {
    id: string;
    role: 'user' | 'member';
    isSynthetic?: boolean;
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
  /** When set, user can open react picker (omit for welcome). */
  onReact?: (emoji: string) => void | Promise<void>;
};

const MAX_VISIBLE_REACTIONS = 12;

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
  onReact,
}: HumanChatPanelMessageBubbleProps) {
  const t = useTranslations('HumanChatPanel');
  const [hoverReactPickerOpen, setHoverReactPickerOpen] = useState(false);
  const [inlineReactPickerOpen, setInlineReactPickerOpen] = useState(false);

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
  const canReact = Boolean(onReact);
  const visibleReactions = reactions.slice(0, MAX_VISIBLE_REACTIONS);
  const hiddenReactionCount = Math.max(
    0,
    reactions.length - MAX_VISIBLE_REACTIONS,
  );

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

        {/* Reactions — Discord-style pills + inline add-reaction (opens picker) */}
        {(visibleReactions.length > 0 || (canReact && onReact)) && (
          <div
            data-testid="chat-message-reactions"
            className="mt-1.5 flex flex-wrap items-center gap-1"
          >
            {visibleReactions.map((reaction, idx) => (
              <button
                key={`${reaction.emoji}-${idx}`}
                type="button"
                disabled={!canReact}
                onClick={() => {
                  if (canReact && onReact) {
                    void onReact(reaction.emoji);
                  }
                }}
                className={cn(
                  'inline-flex h-6 min-w-0 shrink-0 items-center gap-1 rounded-full border px-2 text-xs tabular-nums leading-none transition-colors',
                  reaction.includesCurrentUser
                    ? 'border-[#5865f2]/50 bg-[#5865f2]/15 hover:bg-[#5865f2]/20 dark:border-[#5865f2]/40 dark:bg-[#5865f2]/20'
                    : 'border-[#949ba4]/40 bg-[#f2f3f5] hover:bg-[#e3e5e8] dark:border-border dark:bg-muted/80 dark:hover:bg-muted',
                  canReact ? 'cursor-pointer' : 'cursor-default opacity-80',
                )}
              >
                <span className="text-[15px] leading-none" aria-hidden>
                  {reaction.emoji}
                </span>
                <span
                  className={cn(
                    'text-[11px] font-medium',
                    reaction.includesCurrentUser
                      ? 'text-[#5865f2] dark:text-[#949cf7]'
                      : 'text-[#4e5058] dark:text-muted-foreground',
                  )}
                >
                  {reaction.count}
                </span>
              </button>
            ))}
            {hiddenReactionCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {t('reactionsOverflow', { count: hiddenReactionCount })}
              </span>
            )}
            {canReact && onReact && (
              <HumanChatPanelEmojiPicker
                open={inlineReactPickerOpen}
                onOpenChange={setInlineReactPickerOpen}
                onEmojiSelect={(native) => {
                  void onReact(native);
                }}
                ariaLabel={t('addReactionButton')}
                align="start"
              >
                <button
                  type="button"
                  className={cn(
                    'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#949ba4]/40 bg-[#f2f3f5] text-[#4e5058] transition-colors',
                    'hover:bg-[#e3e5e8] dark:border-border dark:bg-muted/80 dark:text-muted-foreground dark:hover:bg-muted',
                  )}
                  aria-label={t('addReactionButton')}
                  aria-expanded={inlineReactPickerOpen}
                >
                  <SmilePlus className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </HumanChatPanelEmojiPicker>
            )}
          </div>
        )}
      </div>

      {/* Hover / focus-within action bar — match main/live compact toolbar (padding + icon sizing) */}
      <div className="absolute right-2 top-0 -translate-y-1/2 flex items-center gap-0.5 rounded-md border border-border bg-background-2 px-1 py-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shadow-sm">
        <HumanChatPanelEmojiPicker
          open={hoverReactPickerOpen}
          onOpenChange={setHoverReactPickerOpen}
          onEmojiSelect={(native) => {
            if (onReact) void onReact(native);
          }}
          ariaLabel={t('emojiPickerReactToMessage')}
          align="end"
        >
          <button
            type="button"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            aria-label={t('reactButton')}
            disabled={!canReact}
            aria-disabled={!canReact}
            aria-expanded={hoverReactPickerOpen}
          >
            <Smile className="h-3.5 w-3.5" />
          </button>
        </HumanChatPanelEmojiPicker>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label={t('replyButton')}
          disabled={!canReply}
          aria-disabled={!canReply}
          onClick={onReply}
        >
          <Reply className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
