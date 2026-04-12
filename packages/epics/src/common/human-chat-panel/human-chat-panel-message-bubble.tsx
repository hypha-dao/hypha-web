'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import type { TranslationValues } from 'next-intl';
import {
  Smile,
  SmilePlus,
  Reply,
  MoreHorizontal,
  Pencil,
  Copy,
  Link2,
  Volume2,
  Trash2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import { cn, copyToClipboard } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../people/components/person-avatar';

import { HumanChatPanelEmojiPicker } from './human-chat-panel-emoji-picker';
import { HumanChatPanelEmojiMartBody } from './human-chat-panel-emoji-mart-body';
import { ChatMessageRichText } from './parse-simple-matrix-html';
import {
  getRecentMenuEmojis,
  recordRecentMenuEmoji,
} from './chat-quick-reaction-frequency';

type Reaction = {
  emoji: string;
  count: number;
  includesCurrentUser?: boolean;
  reactorUserIds?: string[];
};

type UIMessagePart =
  | { type: 'text'; text: string }
  | { type: string; [k: string]: unknown };

type HumanChatPanelMessageBubbleProps = {
  /** Map Matrix user id to display name for reaction hover tooltips. */
  resolveReactionReactorLabel?: (userId: string) => string;
  /** Parent list ensures at most one message shows the floating action bar. */
  isActionBarVisible?: boolean;
  /** True when this row is the pointer hover target (stronger active state). */
  isRowPointerActive?: boolean;
  onRowPointerEnter?: (e: PointerEvent<HTMLDivElement>) => void;
  onRowPointerLeave?: (e: PointerEvent<HTMLDivElement>) => void;
  /** Notify when the hover-bar emoji picker opens/closes (parent may lock visibility). */
  onHoverReactPickerOpenChange?: (open: boolean) => void;
  /** Same as picker lock, for the “more” overflow menu (portal). */
  onMoreMenuOpenChange?: (open: boolean) => void;
  /** Matrix room id for “copy message link” (permalink with event anchor). */
  matrixRoomId?: string;
  message: {
    id: string;
    role: 'user' | 'member';
    isSynthetic?: boolean;
    parts?: UIMessagePart[];
    senderName?: string;
    avatarUrl?: string;
    timestamp?: Date;
    reactions?: Reaction[];
    /** Matrix formatted_body (subset) for rich display */
    formattedContentHtml?: string;
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
  /** Discord-style one-tap reactions ahead of the picker (from local frequency). */
  quickReactionEmojis?: string[];
  /** When set, Edit is enabled (own text messages). */
  onEditMessage?: () => void;
  /** When set, Delete is enabled (own messages; Matrix redaction). */
  onDeleteMessage?: () => void | Promise<void>;
};

const MAX_VISIBLE_REACTIONS = 12;

/** Discord-style jumbo emoji: cap so huge sticker-style spam stays readable. */
const MAX_JUMBO_EMOJI_COUNT = 27;

/**
 * Split a string into user-perceived grapheme clusters (ZWJ sequences stay together).
 */
function splitGraphemeClusters(s: string): string[] {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    return Array.from(
      new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s),
      ({ segment }) => segment,
    );
  }
  const out: string[] = [];
  const re =
    /\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*/gu;
  let i = 0;
  while (i < s.length) {
    re.lastIndex = i;
    const m = re.exec(s);
    if (m && m.index === i) {
      out.push(m[0]);
      i = re.lastIndex;
      continue;
    }
    const cp = s.codePointAt(i)!;
    const w = cp > 0xffff ? 2 : 1;
    out.push(s.slice(i, i + w));
    i += w;
  }
  return out;
}

const EMOJI_GRAPHEME_RE =
  /^(\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*)$/u;

/** e.g. 🇺🇸 — not matched by Extended_Pictographic alone */
const FLAG_CLUSTER_RE = /^\p{Regional_Indicator}{2}$/u;

function isEmojiGrapheme(g: string): boolean {
  const t = g.trim();
  if (!t) return false;
  return EMOJI_GRAPHEME_RE.test(t) || FLAG_CLUSTER_RE.test(t);
}

/**
 * When the body is only emoji (optional whitespace), render large “jumboji” like Discord.
 * Disabled for rich replies and @mentions so context stays readable.
 */
function getEmojiOnlyJumboLayout(
  raw: string,
  hasReply: boolean,
):
  | { mode: 'normal' }
  | { mode: 'jumbo'; graphemes: string[]; sizeClass: string } {
  const trimmed = raw.trim();
  if (!trimmed || hasReply || /@\S/.test(trimmed)) {
    return { mode: 'normal' };
  }
  const condensed = trimmed.replace(/\s+/g, '');
  if (!condensed) {
    return { mode: 'normal' };
  }
  const graphemes = splitGraphemeClusters(condensed).filter(
    (g) => g.trim().length > 0,
  );
  if (graphemes.length === 0 || graphemes.length > MAX_JUMBO_EMOJI_COUNT) {
    return { mode: 'normal' };
  }
  if (!graphemes.every(isEmojiGrapheme)) {
    return { mode: 'normal' };
  }

  let sizeClass: string;
  if (graphemes.length === 1) {
    sizeClass = 'text-5xl leading-none gap-2';
  } else if (graphemes.length <= 5) {
    sizeClass = 'text-4xl leading-none gap-1';
  } else {
    sizeClass = 'text-3xl leading-none gap-1';
  }

  return { mode: 'jumbo', graphemes, sizeClass };
}

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

/**
 * Strip angle-bracket tags for plain-text copy/speech (SSR-safe, linear time).
 * Avoids regex on HTML strings (CodeQL: polynomial ReDoS on `<` runs).
 */
function stripAngleBracketTagsToPlainText(html: string): string {
  const parts: string[] = [];
  let i = 0;
  while (i < html.length) {
    const c = html[i]!;
    if (c === '<') {
      const close = html.indexOf('>', i + 1);
      if (close === -1) {
        i += 1;
        continue;
      }
      parts.push(' ');
      i = close + 1;
      continue;
    }
    const next = html.indexOf('<', i + 1);
    const end = next === -1 ? html.length : next;
    parts.push(html.slice(i, end));
    i = end;
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}

function stripHtmlToPlainText(html: string): string {
  if (typeof document === 'undefined') {
    return stripAngleBracketTagsToPlainText(html);
  }
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function reactionTooltipText(
  reaction: Reaction,
  resolveLabel: (userId: string) => string,
  t: (key: string, values?: TranslationValues) => string,
): string | undefined {
  const ids = reaction.reactorUserIds;
  if (!ids?.length) return undefined;
  const names = ids.map((id) => resolveLabel(id));
  return t('reactionReactorsTooltip', {
    names: names.join(', '),
    emoji: reaction.emoji,
  });
}

export function HumanChatPanelMessageBubble({
  resolveReactionReactorLabel,
  isActionBarVisible = false,
  isRowPointerActive = false,
  onRowPointerEnter,
  onRowPointerLeave,
  onHoverReactPickerOpenChange,
  onMoreMenuOpenChange,
  matrixRoomId,
  message,
  isStreaming,
  onReply,
  onReact,
  quickReactionEmojis,
  onEditMessage,
  onDeleteMessage,
}: HumanChatPanelMessageBubbleProps) {
  const t = useTranslations('HumanChatPanel');
  const [hoverReactPickerOpen, setHoverReactPickerOpen] = useState(false);
  const [inlineReactPickerOpen, setInlineReactPickerOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  /** When set, the overflow menu was opened via row context menu; anchor at fixed coords. */
  const [contextMenuAnchor, setContextMenuAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // TODO: Handle non-text parts (file attachments, tool results, etc.)
  const textParts =
    message.parts?.filter(
      (p): p is { type: 'text'; text: string } => p.type === 'text',
    ) ?? [];
  const textContent = textParts.map((p) => p.text).join('');
  const plainTextForActions = useMemo(() => {
    if (message.formattedContentHtml) {
      return stripHtmlToPlainText(message.formattedContentHtml);
    }
    return textContent;
  }, [message.formattedContentHtml, textContent]);
  const replyTo = message.replyTo;
  const jumboLayout = textContent
    ? getEmojiOnlyJumboLayout(textContent, Boolean(replyTo))
    : { mode: 'normal' as const };

  const senderName = message.senderName ?? t('you');
  const timestamp = message.timestamp
    ? formatTimestamp(message.timestamp, t)
    : undefined;
  const reactions = message.reactions ?? [];
  const canReply = Boolean(onReply);
  const canReact = Boolean(onReact);
  const canEdit = Boolean(
    onEditMessage &&
      (plainTextForActions.trim().length > 0 ||
        Boolean(message.formattedContentHtml?.trim())),
  );
  const canDelete = Boolean(onDeleteMessage);
  const quickStrip =
    canReact &&
    onReact &&
    quickReactionEmojis &&
    quickReactionEmojis.length > 0;
  const visibleReactions = reactions.slice(0, MAX_VISIBLE_REACTIONS);
  const hiddenReactionCount = Math.max(
    0,
    reactions.length - MAX_VISIBLE_REACTIONS,
  );

  const showMessageOverflowMenu = !message.isSynthetic;

  const canCopyMessageLink = Boolean(
    matrixRoomId &&
      showMessageOverflowMenu &&
      message.id &&
      !message.id.startsWith('~'),
  );

  const matrixMessageLink = useMemo(() => {
    if (!canCopyMessageLink || !matrixRoomId) return '';
    return `matrix:r/${encodeURIComponent(matrixRoomId)}/e/${encodeURIComponent(
      message.id,
    )}`;
  }, [canCopyMessageLink, matrixRoomId, message.id]);

  const handleCopyText = useCallback(() => {
    const text = plainTextForActions.trim();
    if (!text) return;
    copyToClipboard(text);
  }, [plainTextForActions]);

  const handleCopyLink = useCallback(() => {
    if (!matrixMessageLink) return;
    copyToClipboard(matrixMessageLink);
  }, [matrixMessageLink]);

  const handleSpeak = useCallback(() => {
    const text = plainTextForActions.trim();
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = document.documentElement.lang || 'en';
    window.speechSynthesis.speak(u);
  }, [plainTextForActions]);

  const recentMenuEmojis = moreMenuOpen ? getRecentMenuEmojis(4) : [];

  const handleMessageContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.button !== 2 || !showMessageOverflowMenu) return;
      e.preventDefault();
      /** Radix positions `side="left"` content to the left of the anchor; keep anchor inset so the menu stays inside the chat scroll panel. */
      const APPROX_MENU_WIDTH = 188;
      const PAD = 8;
      const scrollEl = (e.currentTarget as HTMLElement).closest(
        '[data-chat-messages-scroll]',
      ) as HTMLElement | null;
      let x = e.clientX;
      let y = e.clientY;
      if (scrollEl) {
        const r = scrollEl.getBoundingClientRect();
        const minX = r.left + APPROX_MENU_WIDTH + PAD;
        const maxX = r.right - PAD;
        const minY = r.top + PAD;
        const maxY = r.bottom - PAD;
        if (minX <= maxX) {
          x = Math.min(Math.max(x, minX), maxX);
        } else {
          x = (r.left + r.right) / 2;
        }
        if (minY <= maxY) {
          y = Math.min(Math.max(y, minY), maxY);
        }
      }
      setContextMenuAnchor({ x, y });
      // Defer past the contextmenu event so Radix does not treat the gesture as
      // an outside dismiss on the same tick (stable single trigger button).
      queueMicrotask(() => {
        setMoreMenuOpen(true);
        onMoreMenuOpenChange?.(true);
      });
    },
    [showMessageOverflowMenu, onMoreMenuOpenChange],
  );

  const handleMoreMenuOpenChange = useCallback(
    (open: boolean) => {
      if (!showMessageOverflowMenu) return;
      setMoreMenuOpen(open);
      onMoreMenuOpenChange?.(open);
      if (!open) {
        setContextMenuAnchor(null);
      }
    },
    [showMessageOverflowMenu, onMoreMenuOpenChange],
  );

  useEffect(() => {
    if (isActionBarVisible) return;
    setMoreMenuOpen(false);
    setContextMenuAnchor(null);
    setHoverReactPickerOpen(false);
    onHoverReactPickerOpenChange?.(false);
  }, [isActionBarVisible, onHoverReactPickerOpenChange]);

  return (
    <div
      data-testid="chat-message"
      className={cn(
        'group relative -mx-3 flex gap-3 rounded-md px-3 py-0.5 transition-colors',
        /* Discord-style row tint: hover (primary) + focus-within for keyboard/reactions */
        'hover:bg-muted/60 focus-within:bg-muted/60',
        isRowPointerActive &&
          'bg-primary/10 ring-1 ring-primary/25 dark:bg-primary/15 dark:ring-primary/30',
      )}
      onPointerEnter={onRowPointerEnter}
      onPointerLeave={onRowPointerLeave}
      onContextMenu={handleMessageContextMenu}
    >
      {/* Avatar */}
      <div className="mt-0.5 shrink-0" data-testid="chat-message-avatar">
        <PersonAvatar
          size="sm"
          shape="circle"
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
            className="mt-0.5 min-w-0 border-l-2 border-primary/40 pl-2 text-xs text-muted-foreground"
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

        {/* Message text — Matrix HTML, or Discord-style jumboji, or plain + mentions */}
        {textContent &&
          (message.formattedContentHtml ? (
            <p
              data-testid="chat-message-body"
              className="mt-0 text-sm leading-snug text-foreground"
            >
              <ChatMessageRichText html={message.formattedContentHtml} />
            </p>
          ) : jumboLayout.mode === 'jumbo' ? (
            <p
              data-testid="chat-message-body"
              className={cn(
                'mt-0 flex flex-wrap items-end text-foreground',
                jumboLayout.sizeClass,
              )}
              aria-label={textContent.trim()}
            >
              {jumboLayout.graphemes.map((g, i) => (
                <span key={`${g}-${i}`} aria-hidden>
                  {g}
                </span>
              ))}
            </p>
          ) : (
            <p
              data-testid="chat-message-body"
              className="mt-0 text-sm leading-snug text-foreground"
            >
              {renderTextWithMentions(textContent)}
            </p>
          ))}

        {/* Streaming indicator */}
        {isStreaming && (
          <span className="mt-1 inline-flex items-center gap-0.5">
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary" />
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary [animation-delay:0.2s]" />
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary [animation-delay:0.4s]" />
          </span>
        )}

        {/* Reactions — Discord-style pills; inline add-reaction only when ≥1 reaction exists */}
        {visibleReactions.length > 0 && (
          <div
            data-testid="chat-message-reactions"
            className="mt-1 flex flex-wrap items-center gap-0.5"
          >
            {visibleReactions.map((reaction) => {
              const tooltip =
                resolveReactionReactorLabel &&
                reactionTooltipText(reaction, resolveReactionReactorLabel, t);
              const pill = (
                <button
                  type="button"
                  disabled={!canReact}
                  aria-pressed={Boolean(reaction.includesCurrentUser)}
                  onClick={() => {
                    if (canReact && onReact) {
                      void onReact(reaction.emoji);
                    }
                  }}
                  className={cn(
                    /* Discord: rounded rectangle frame, not a full pill */
                    'inline-flex h-5 min-w-0 shrink-0 items-center gap-0.5 rounded-md border px-1.5 text-xs tabular-nums leading-none transition-colors',
                    reaction.includesCurrentUser
                      ? 'border-[#5865f2]/50 bg-[#5865f2]/15 hover:bg-[#5865f2]/20 dark:border-[#5865f2]/40 dark:bg-[#5865f2]/20'
                      : 'border-border bg-muted/80 hover:bg-muted',
                    canReact ? 'cursor-pointer' : 'cursor-default opacity-80',
                  )}
                >
                  <span className="text-[13px] leading-none" aria-hidden>
                    {reaction.emoji}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-medium leading-none',
                      reaction.includesCurrentUser
                        ? 'text-[#5865f2] dark:text-[#949cf7]'
                        : 'text-muted-foreground',
                    )}
                  >
                    {reaction.count}
                  </span>
                </button>
              );

              if (tooltip) {
                return (
                  <Tooltip key={reaction.emoji} delayDuration={300}>
                    <TooltipTrigger asChild>{pill}</TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-xs text-left text-xs leading-snug"
                    >
                      {tooltip}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return <Fragment key={reaction.emoji}>{pill}</Fragment>;
            })}
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
                  recordRecentMenuEmoji(native);
                  void onReact(native);
                }}
                ariaLabel={t('addReactionButton')}
                align="start"
              >
                <button
                  type="button"
                  className={cn(
                    'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border',
                    'bg-muted/80 text-muted-foreground transition-colors hover:bg-muted',
                  )}
                  aria-label={t('addReactionButton')}
                  aria-expanded={inlineReactPickerOpen}
                >
                  <SmilePlus className="h-3 w-3" strokeWidth={2} />
                </button>
              </HumanChatPanelEmojiPicker>
            )}
          </div>
        )}
      </div>

      {/* Floating action bar: tight width, subtle corner radius (Discord-like) */}
      <div
        className={cn(
          'absolute right-3 top-0 z-10 inline-flex h-[22px] -translate-y-1/2 items-center gap-0 rounded border border-border bg-popover px-px py-0 leading-none text-popover-foreground shadow-md ring-1 ring-black/5 dark:ring-white/10 transition-opacity duration-150',
          isActionBarVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!isActionBarVisible}
      >
        {quickStrip &&
          quickReactionEmojis!.slice(0, 3).map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[2px] p-0 text-[12px] leading-none transition-colors hover:bg-muted"
              aria-label={t('quickReactWith', { emoji })}
              onClick={() => {
                void onReact!(emoji);
              }}
            >
              <span aria-hidden>{emoji}</span>
            </button>
          ))}
        {quickStrip ? (
          <div
            role="separator"
            aria-orientation="vertical"
            className="h-3 w-px shrink-0 bg-border"
          />
        ) : null}
        <HumanChatPanelEmojiPicker
          open={hoverReactPickerOpen}
          onOpenChange={(open) => {
            setHoverReactPickerOpen(open);
            onHoverReactPickerOpenChange?.(open);
          }}
          onEmojiSelect={(native) => {
            recordRecentMenuEmoji(native);
            if (onReact) void onReact(native);
          }}
          ariaLabel={t('emojiPickerReactToMessage')}
          align="end"
        >
          <button
            type="button"
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[2px] p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:block"
            aria-label={t('reactButton')}
            disabled={!canReact}
            aria-disabled={!canReact}
            aria-expanded={hoverReactPickerOpen}
          >
            <Smile className="h-3 w-3" strokeWidth={2} />
          </button>
        </HumanChatPanelEmojiPicker>
        <button
          type="button"
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[2px] p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:block"
          aria-label={t('editButton')}
          disabled={!canEdit}
          aria-disabled={!canEdit}
          onClick={onEditMessage}
        >
          <Pencil className="h-3 w-3" strokeWidth={2} />
        </button>
        <button
          type="button"
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[2px] p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:block"
          aria-label={t('replyButton')}
          disabled={!canReply}
          aria-disabled={!canReply}
          onClick={onReply}
        >
          <Reply className="h-3 w-3" strokeWidth={2} />
        </button>
        <DropdownMenu
          modal={false}
          open={showMessageOverflowMenu ? moreMenuOpen : false}
          onOpenChange={handleMoreMenuOpenChange}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid="chat-message-more-trigger"
              aria-label={t('moreButton')}
              aria-expanded={moreMenuOpen}
              disabled={!showMessageOverflowMenu}
              aria-disabled={!showMessageOverflowMenu}
              className={cn(
                'shrink-0 rounded-[2px] p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[state=open]:bg-muted disabled:pointer-events-none disabled:opacity-40 [&_svg]:block',
                contextMenuAnchor
                  ? 'pointer-events-none fixed z-20 h-1 w-1 min-w-0 border-0 bg-transparent opacity-0'
                  : 'relative flex h-[22px] w-[22px] items-center justify-center',
              )}
              style={
                contextMenuAnchor
                  ? {
                      left: contextMenuAnchor.x,
                      top: contextMenuAnchor.y,
                    }
                  : undefined
              }
            >
              {!contextMenuAnchor ? (
                <MoreHorizontal className="h-3 w-3" strokeWidth={2} />
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="left"
            align="start"
            collisionPadding={12}
            className="z-[50] w-[min(100vw-2rem,172px)] overflow-visible border border-border px-1 py-0.5 shadow-lg"
          >
            {canReact && onReact && recentMenuEmojis.length > 0 ? (
              <>
                <div className="flex justify-center gap-0.5 px-0.5 pb-1 pt-0.5">
                  {recentMenuEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-[13px] leading-none transition-colors hover:bg-muted"
                      aria-label={t('quickReactWith', { emoji })}
                      onClick={() => {
                        recordRecentMenuEmoji(emoji);
                        void onReact(emoji);
                        setMoreMenuOpen(false);
                      }}
                    >
                      <span aria-hidden>{emoji}</span>
                    </button>
                  ))}
                </div>
                <DropdownMenuSeparator className="my-0.5 bg-border" />
              </>
            ) : null}
            {canReact && onReact ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex h-7 min-h-7 w-full items-center rounded-sm px-1.5 py-0 text-[11px] leading-tight outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:!size-3">
                  <span className="min-w-0 flex-1 truncate text-left">
                    {t('messageMenuAddReaction')}
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className="z-[300] overflow-visible border border-border bg-popover p-0 shadow-xl"
                  sideOffset={6}
                >
                  <HumanChatPanelEmojiMartBody
                    compact
                    onEmojiSelect={(native) => {
                      recordRecentMenuEmoji(native);
                      void onReact(native);
                      setMoreMenuOpen(false);
                    }}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
            {canReact && onReact ? (
              <DropdownMenuSeparator className="my-0.5 bg-border" />
            ) : null}
            <DropdownMenuItem
              className="flex h-7 min-h-7 items-center justify-between gap-1.5 rounded-sm px-1.5 py-0 text-[11px] leading-tight [&_svg]:!size-3"
              disabled={!canEdit}
              onSelect={(e) => {
                e.preventDefault();
                onEditMessage?.();
                setMoreMenuOpen(false);
              }}
            >
              <span className="truncate">{t('messageMenuEdit')}</span>
              <Pencil className="shrink-0 opacity-70" strokeWidth={2} />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex h-7 min-h-7 items-center justify-between gap-1.5 rounded-sm px-1.5 py-0 text-[11px] leading-tight [&_svg]:!size-3"
              disabled={!canReply}
              onSelect={(e) => {
                e.preventDefault();
                onReply?.();
                setMoreMenuOpen(false);
              }}
            >
              <span className="truncate">{t('messageMenuReply')}</span>
              <Reply className="shrink-0 opacity-70" strokeWidth={2} />
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-0.5 bg-border" />
            <DropdownMenuItem
              className="flex h-7 min-h-7 items-center justify-between gap-1.5 rounded-sm px-1.5 py-0 text-[11px] leading-tight [&_svg]:!size-3"
              disabled={!plainTextForActions.trim()}
              onSelect={(e) => {
                e.preventDefault();
                handleCopyText();
                setMoreMenuOpen(false);
              }}
            >
              <span className="truncate">{t('messageMenuCopyText')}</span>
              <Copy className="shrink-0 opacity-70" strokeWidth={2} />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex h-7 min-h-7 items-center justify-between gap-1.5 rounded-sm px-1.5 py-0 text-[11px] leading-tight [&_svg]:!size-3"
              disabled={!canCopyMessageLink}
              onSelect={(e) => {
                e.preventDefault();
                handleCopyLink();
                setMoreMenuOpen(false);
              }}
            >
              <span className="truncate">{t('messageMenuCopyLink')}</span>
              <Link2 className="shrink-0 opacity-70" strokeWidth={2} />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex h-7 min-h-7 items-center justify-between gap-1.5 rounded-sm px-1.5 py-0 text-[11px] leading-tight [&_svg]:!size-3"
              disabled={!plainTextForActions.trim()}
              onSelect={(e) => {
                e.preventDefault();
                handleSpeak();
                setMoreMenuOpen(false);
              }}
            >
              <span className="truncate">{t('messageMenuSpeak')}</span>
              <Volume2 className="shrink-0 opacity-70" strokeWidth={2} />
            </DropdownMenuItem>
            {canDelete ? (
              <>
                <DropdownMenuSeparator className="my-0.5 bg-border" />
                <DropdownMenuItem
                  className="flex h-7 min-h-7 items-center justify-between gap-1.5 rounded-sm px-1.5 py-0 text-[11px] leading-tight text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:!size-3"
                  onSelect={(e) => {
                    e.preventDefault();
                    void onDeleteMessage?.();
                    setMoreMenuOpen(false);
                  }}
                >
                  <span className="truncate">{t('messageMenuDelete')}</span>
                  <Trash2 className="shrink-0 opacity-90" strokeWidth={2} />
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
