'use client';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { Loader2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { Button } from '@hypha-platform/ui';

import { useIsMobile, usePrefersCoarsePointer } from '@hypha-platform/ui';

import { HumanChatPanelDateSeparator } from './human-chat-panel-date-separator';
import { HumanChatPanelUnreadDivider } from './human-chat-panel-unread-divider';
import { HumanChatPanelMessageBubble } from './human-chat-panel-message-bubble';
import { touchComposerFromViewportFlags } from './touch-composer-flags';
import type { ChatPanelAttachmentMedia } from './chat-panel-media-types';
import {
  asTimelineDate,
  shouldStickChatTimelineToBottom,
  sortMessagesChronologically,
} from './human-chat-timeline-order';

/**
 * Scroll a row inside the timeline scroller only — never call `scrollIntoView`,
 * which also moves ancestor panels (e.g. the proposal overlay).
 * Pin near the top so a reply that is already “just above” still moves
 * clearly instead of centering in place with no visible jump.
 */
function scrollChildIntoTimeline(
  container: HTMLElement,
  child: HTMLElement,
  behavior: ScrollBehavior = 'smooth',
) {
  const cRect = container.getBoundingClientRect();
  const eRect = child.getBoundingClientRect();
  const topPad = Math.min(72, Math.max(24, cRect.height * 0.12));
  const next = container.scrollTop + (eRect.top - cRect.top) - topPad;
  container.scrollTo({
    top: Math.max(0, next),
    behavior,
  });
}

type UIMessage = {
  id: string;
  role: 'user' | 'member';
  /** Non-Matrix / system rows: no reply or reactions. */
  isSynthetic?: boolean;
  sendPending?: {
    attachmentCount: number;
    captionPreview: string;
    uploadedCount?: number;
  };
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
  media?: ChatPanelAttachmentMedia;
  /** Multiple attachments in one Matrix event (`org.hypha.media_bundle`). */
  mediaSlots?: ChatPanelAttachmentMedia[];
  senderName?: string;
  /** Matrix author MXID when known. */
  senderMatrixId?: string;
  /** Specialist who answered an @AI Agents mention. */
  agentSpecialistId?: string;
  avatarUrl?: string;
  timestamp?: Date;
  /** True when the Matrix root was edited (`m.replace`). */
  edited?: boolean;
  formattedContentHtml?: string;
  reactions?: Array<{
    emoji: string;
    count: number;
    includesCurrentUser?: boolean;
    reactorUserIds?: string[];
  }>;
  replyTo?: {
    /** Matrix event id of the quoted message (scroll target). */
    eventId?: string;
    authorLabel: string;
    excerpt?: string;
    /** Matrix MXID of quoted author (for avatar refresh). */
    sourceUserId?: string;
    authorAvatarUrl?: string;
  };
};

function dayKeyLocal(d: Date): string | null {
  const date = asTimelineDate(d);
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDividerLabel(
  date: Date,
  formatter: ReturnType<typeof useFormatter>,
): string {
  const safe = asTimelineDate(date);
  if (!safe) return '';
  try {
    return formatter.dateTime(safe, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/** Compact date for the unread strip — full weekday wraps poorly beside the action. */
function formatUnreadBannerDateLabel(
  date: Date,
  formatter: ReturnType<typeof useFormatter>,
): string {
  const safe = asTimelineDate(date);
  if (!safe) return '';
  try {
    return formatter.dateTime(safe, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

type TimelineRow =
  | { kind: 'date'; key: string; date: Date }
  | { kind: 'unread'; key: 'unread-divider' }
  | {
      kind: 'message';
      key: string;
      message: UIMessage;
      isFirstUnread: boolean;
    };

function buildTimelineRows(
  messages: UIMessage[],
  firstUnreadMessageId: string | null | undefined,
): TimelineRow[] {
  const rows: TimelineRow[] = [];
  let prevDay: string | null = null;
  let insertedUnread = !firstUnreadMessageId;
  const ordered = sortMessagesChronologically(messages);

  for (const msg of ordered) {
    const ts = asTimelineDate(msg.timestamp);
    if (ts) {
      const dk = dayKeyLocal(ts);
      if (dk && dk !== prevDay) {
        rows.push({
          kind: 'date',
          key: `day-${dk}`,
          date: new Date(ts.getFullYear(), ts.getMonth(), ts.getDate()),
        });
        prevDay = dk;
      }
    }

    if (
      !insertedUnread &&
      firstUnreadMessageId &&
      msg.id === firstUnreadMessageId
    ) {
      rows.push({ kind: 'unread', key: 'unread-divider' });
      insertedUnread = true;
    }

    rows.push({
      kind: 'message',
      key: msg.id,
      message: msg,
      isFirstUnread: Boolean(
        firstUnreadMessageId && msg.id === firstUnreadMessageId,
      ),
    });
  }

  return rows;
}

type HumanChatPanelMessagesProps = {
  messages: UIMessage[];
  isStreaming?: boolean;
  roomId?: string | null;
  currentUserId?: string | null;
  currentUserAvatarUrl?: string | null;
  /** Replaces the default space welcome. Space chat leaves both unset. */
  welcomeText?: string;
  welcomeSenderName?: string;
  onReply?: (messageId: string) => void;
  /** Jump the timeline to the quoted original when a reply header is clicked. */
  onJumpToOriginalMessage?: (eventId: string) => void;
  onEditMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void | Promise<void>;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  /** Map Matrix user id to display name for reaction hover tooltips. */
  resolveReactionReactorLabel?: (userId: string) => string;
  /** Map Matrix user id to display name inside @mention pills (body + formatted HTML). */
  resolveMatrixMemberLabel?: (userId: string) => string;
  /** Roster-first labels for message sender / reply headers (Hypha Members tab names). */
  resolveSenderDisplayLabel?: (matrixUserId: string | undefined) => string;
  onCancelSendPending?: () => void;
  /** Oldest unread Matrix event id (from read receipt); scroll + divider. */
  firstUnreadMessageId?: string | null;
  /** True while unread count from homeserver is capped (e.g. 100+). */
  unreadCountIsCapped?: boolean;
  /** Notification count from Matrix (badge / banner). */
  unreadNotificationCount?: number;
  /** Called when the scroll viewport reaches the bottom (mark read). */
  onReachedTimelineBottom?: () => void;
  /** False while the member is reading earlier messages. */
  onTimelineAtBottomChange?: (atBottom: boolean) => void;
  /** When false the thread is off-screen, so reaching the bottom must not count as read. */
  viewportActive?: boolean;
  /** User clicked “Mark as read” in the banner. */
  onMarkAsReadFromBanner?: () => void;
  /** Scroll this Matrix event id into view when set (e.g. mention inbox). */
  scrollTargetEventId?: string | null;
  onConsumedScrollTarget?: () => void;
  onScrollTargetNotFound?: (eventId: string) => void;
  hasMoreOlderMessages?: boolean;
  loadingOlderMessages?: boolean;
  /** When false, the top sentinel will not auto-trigger history loads (follower tabs). */
  enableAutoLoadOlderMessages?: boolean;
  onLoadOlderMessages?: (source?: 'auto' | 'manual') => void | Promise<void | {
    addedEvents: number;
    hasMoreOlder: boolean;
  }>;
};

export function HumanChatPanelMessages({
  messages,
  isStreaming = false,
  roomId,
  currentUserId,
  currentUserAvatarUrl,
  welcomeText,
  welcomeSenderName,
  onReply,
  onJumpToOriginalMessage,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  resolveReactionReactorLabel,
  resolveMatrixMemberLabel,
  resolveSenderDisplayLabel,
  onCancelSendPending,
  firstUnreadMessageId,
  unreadCountIsCapped = false,
  unreadNotificationCount = 0,
  onReachedTimelineBottom,
  onTimelineAtBottomChange,
  viewportActive = true,
  onMarkAsReadFromBanner,
  scrollTargetEventId,
  onConsumedScrollTarget,
  onScrollTargetNotFound,
  hasMoreOlderMessages = false,
  loadingOlderMessages = false,
  enableAutoLoadOlderMessages = true,
  onLoadOlderMessages,
}: HumanChatPanelMessagesProps) {
  const t = useTranslations('HumanChatPanel');
  const formatter = useFormatter();
  const isMobile = useIsMobile();
  const prefersCoarsePointer = usePrefersCoarsePointer();
  const isTouchComposer = touchComposerFromViewportFlags(
    isMobile,
    prefersCoarsePointer,
  );

  const welcomeMessage: UIMessage = {
    id: 'welcome',
    role: 'member',
    isSynthetic: true,
    parts: [{ type: 'text', text: welcomeText ?? t('welcome') }],
    senderName: welcomeSenderName ?? t('chatRoomTitle'),
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLastIdRef = useRef<string | null>(null);
  const stickToBottomRef = useRef(true);
  const initialUnreadScrollDoneRef = useRef(false);
  const prevRoomIdRef = useRef<string | null | undefined>(undefined);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const loadOlderInFlightRef = useRef(false);
  /** Blocks auto-load after a zero-progress attempt; manual button clears this. */
  const lastAutoLoadAddedEventsRef = useRef<number | undefined>(undefined);
  const scrollPreserveRef = useRef<{ height: number; top: number } | null>(
    null,
  );
  /** Avoid calling onConsumedScrollTarget repeatedly while scrollTargetEventId is unchanged. */
  const scrollTargetConsumedRef = useRef<string | null>(null);
  /** Retry deep-link target lookup across timeline growth before falling back. */
  const scrollTargetMissCountRef = useRef(0);
  const scrollTargetMissHandledRef = useRef<string | null>(null);
  /** Brief flash on the jumped-to row so a nearby original is still obvious. */
  const [jumpFlashMessageId, setJumpFlashMessageId] = useState<string | null>(
    null,
  );
  const jumpFlashClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashJumpedMessage = useCallback((messageId: string) => {
    if (jumpFlashClearRef.current != null) {
      clearTimeout(jumpFlashClearRef.current);
      jumpFlashClearRef.current = null;
    }
    setJumpFlashMessageId(messageId);
    jumpFlashClearRef.current = setTimeout(() => {
      jumpFlashClearRef.current = null;
      setJumpFlashMessageId((current) =>
        current === messageId ? null : current,
      );
    }, 1400);
  }, []);

  useEffect(
    () => () => {
      if (jumpFlashClearRef.current != null) {
        clearTimeout(jumpFlashClearRef.current);
      }
    },
    [],
  );

  /** At most one floating action bar: pointer hover, or locked while that row's hover emoji picker is open. */
  const [hoverActionMessageId, setHoverActionMessageId] = useState<
    string | null
  >(null);
  const [lockActionMessageId, setLockActionMessageId] = useState<string | null>(
    null,
  );
  const lockActionMessageIdRef = useRef<string | null>(null);
  lockActionMessageIdRef.current = lockActionMessageId;
  /** Pointer left row while hover picker was open (portal); hide bar when picker closes. */
  const leaveWhileLockedRef = useRef<string | null>(null);

  const displayMessages =
    messages.length > 0
      ? sortMessagesChronologically(messages)
      : [welcomeMessage];

  const timelineRows = useMemo(
    () => buildTimelineRows(displayMessages, firstUnreadMessageId),
    [displayMessages, firstUnreadMessageId],
  );

  const firstUnreadMeta = useMemo(() => {
    if (!firstUnreadMessageId) {
      return {
        dateLabel: null as string | null,
        timeLabel: null as string | null,
      };
    }
    const target = displayMessages.find((m) => m.id === firstUnreadMessageId);
    const ts = asTimelineDate(target?.timestamp);
    if (!ts) {
      return {
        dateLabel: null as string | null,
        timeLabel: null as string | null,
      };
    }
    try {
      const dateLabel = formatUnreadBannerDateLabel(ts, formatter);
      const timeLabel = formatter.dateTime(ts, {
        timeStyle: 'short',
        dateStyle: undefined,
      });
      if (!dateLabel || !timeLabel) {
        return {
          dateLabel: null as string | null,
          timeLabel: null as string | null,
        };
      }
      return { dateLabel, timeLabel };
    } catch {
      return {
        dateLabel: null as string | null,
        timeLabel: null as string | null,
      };
    }
  }, [displayMessages, firstUnreadMessageId, formatter]);

  const showUnreadBanner =
    Boolean(firstUnreadMessageId) &&
    Boolean(firstUnreadMeta.dateLabel && firstUnreadMeta.timeLabel);

  const scrollToUnread = useCallback(() => {
    if (!firstUnreadMessageId) return;
    const root = containerRef.current;
    if (!root) return;
    const escaped =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(firstUnreadMessageId)
        : firstUnreadMessageId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const el = root.querySelector(
      `[data-matrix-event-id="${escaped}"]`,
    ) as HTMLElement | null;
    if (el) scrollChildIntoTimeline(root, el);
    stickToBottomRef.current = false;
    onTimelineAtBottomChange?.(false);
  }, [firstUnreadMessageId, onTimelineAtBottomChange]);

  useEffect(() => {
    if (roomId !== prevRoomIdRef.current) {
      prevRoomIdRef.current = roomId;
      initialUnreadScrollDoneRef.current = false;
      scrollPreserveRef.current = null;
      lastAutoLoadAddedEventsRef.current = undefined;
    }
  }, [roomId]);

  useEffect(() => {
    const el = containerRef.current;
    if (loadingOlderMessages && el) {
      scrollPreserveRef.current = {
        height: el.scrollHeight,
        top: el.scrollTop,
      };
    }
  }, [loadingOlderMessages]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    const preserve = scrollPreserveRef.current;
    if (!loadingOlderMessages && preserve && el) {
      el.scrollTop = el.scrollHeight - preserve.height + preserve.top;
      scrollPreserveRef.current = null;
    }
  }, [loadingOlderMessages, messages.length]);

  useEffect(() => {
    const root = containerRef.current;
    const sentinel = topSentinelRef.current;
    if (
      !root ||
      !sentinel ||
      !onLoadOlderMessages ||
      !enableAutoLoadOlderMessages ||
      !hasMoreOlderMessages ||
      loadingOlderMessages
    ) {
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || loadOlderInFlightRef.current) continue;
          if (lastAutoLoadAddedEventsRef.current === 0) continue;
          loadOlderInFlightRef.current = true;
          void Promise.resolve(onLoadOlderMessages('auto'))
            .then((result) => {
              if (
                !result ||
                typeof result !== 'object' ||
                !('addedEvents' in result)
              ) {
                return;
              }
              if (result.addedEvents === 0 && result.hasMoreOlder) {
                lastAutoLoadAddedEventsRef.current = 0;
                return;
              }
              if (result.addedEvents > 0) {
                lastAutoLoadAddedEventsRef.current = result.addedEvents;
              }
            })
            .finally(() => {
              loadOlderInFlightRef.current = false;
            });
        }
      },
      { root, threshold: 0.1 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [
    enableAutoLoadOlderMessages,
    hasMoreOlderMessages,
    loadingOlderMessages,
    onLoadOlderMessages,
    timelineRows.length,
  ]);

  useEffect(() => {
    if (!scrollTargetEventId) {
      scrollTargetConsumedRef.current = null;
      scrollTargetMissCountRef.current = 0;
      scrollTargetMissHandledRef.current = null;
      return;
    }
    if (scrollTargetMissHandledRef.current !== scrollTargetEventId) {
      scrollTargetMissCountRef.current = 0;
      scrollTargetMissHandledRef.current = null;
    }
  }, [scrollTargetEventId]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const len = messages.length;
    const lastId = len > 0 ? messages[len - 1]!.id : null;
    const prevLastId = prevLastIdRef.current;

    const newestIsOwn =
      len > 0 &&
      lastId != null &&
      lastId !== prevLastId &&
      messages[len - 1]?.role === 'user';

    const shouldScrollUnread =
      Boolean(firstUnreadMessageId) &&
      !initialUnreadScrollDoneRef.current &&
      messages.some((m) => m.id === firstUnreadMessageId);

    if (shouldScrollUnread) {
      initialUnreadScrollDoneRef.current = true;
      stickToBottomRef.current = false;
      onTimelineAtBottomChange?.(false);
      window.requestAnimationFrame(() => {
        scrollToUnread();
      });
      prevLastIdRef.current = lastId;
      return;
    }

    if (
      shouldStickChatTimelineToBottom({
        alreadyStuckToBottom: stickToBottomRef.current,
        newestMessageIsOwn: newestIsOwn,
        isStreaming,
      })
    ) {
      stickToBottomRef.current = true;
      onTimelineAtBottomChange?.(true);
      container.scrollTop = container.scrollHeight;
    }

    prevLastIdRef.current = lastId;
  }, [
    messages,
    isStreaming,
    firstUnreadMessageId,
    onTimelineAtBottomChange,
    scrollToUnread,
  ]);

  useLayoutEffect(() => {
    if (!scrollTargetEventId) return;
    if (scrollTargetConsumedRef.current === scrollTargetEventId) return;
    const root = containerRef.current;
    if (!root) return;

    const esc =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(scrollTargetEventId)
        : scrollTargetEventId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    let cancelled = false;
    let frames = 0;
    const maxFrames = 24;

    const tryJump = () => {
      if (cancelled) return;
      const row = root.querySelector(`[data-matrix-event-id="${esc}"]`);
      if (row instanceof HTMLElement) {
        stickToBottomRef.current = false;
        onTimelineAtBottomChange?.(false);
        scrollChildIntoTimeline(root, row);
        flashJumpedMessage(scrollTargetEventId);
        scrollTargetConsumedRef.current = scrollTargetEventId;
        scrollTargetMissCountRef.current = 0;
        scrollTargetMissHandledRef.current = null;
        onConsumedScrollTarget?.();
        return;
      }

      frames += 1;
      if (frames >= maxFrames) {
        if (scrollTargetMissHandledRef.current !== scrollTargetEventId) {
          scrollTargetMissHandledRef.current = scrollTargetEventId;
          onScrollTargetNotFound?.(scrollTargetEventId);
        }
        return;
      }
      scrollTargetMissCountRef.current = frames;
      requestAnimationFrame(tryJump);
    };

    tryJump();
    return () => {
      cancelled = true;
    };
  }, [
    scrollTargetEventId,
    flashJumpedMessage,
    onConsumedScrollTarget,
    onScrollTargetNotFound,
    onTimelineAtBottomChange,
    timelineRows.length,
  ]);

  useEffect(() => {
    const root = containerRef.current;
    const sentinel = bottomSentinelRef.current;
    if (!viewportActive || !root || !sentinel || !onReachedTimelineBottom) {
      return;
    }

    const bottomIsVisible = () => {
      const rootRect = root.getBoundingClientRect();
      if (rootRect.height < 8 || rootRect.width < 8) return false;
      const rect = sentinel.getBoundingClientRect();
      return rect.top <= rootRect.bottom && rect.bottom >= rootRect.top;
    };
    const markIfSeen = () => {
      if (bottomIsVisible()) onReachedTimelineBottom();
    };

    markIfSeen();
    const frame = requestAnimationFrame(markIfSeen);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onReachedTimelineBottom();
        }
      },
      { root, threshold: 0.01 },
    );
    io.observe(sentinel);
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
    };
  }, [onReachedTimelineBottom, timelineRows.length, viewportActive]);

  useEffect(() => {
    if (
      !isTouchComposer ||
      (hoverActionMessageId == null && lockActionMessageId == null)
    ) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(
          '[data-radix-popper-content-wrapper], [data-radix-menu-content], [role="menu"], [role="listbox"], [data-chat-message-actions]',
        )
      ) {
        return;
      }
      const row = target.closest('[data-matrix-event-id]');
      if (row && containerRef.current?.contains(row)) return;
      setHoverActionMessageId(null);
      setLockActionMessageId(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [hoverActionMessageId, isTouchComposer, lockActionMessageId]);

  const messageIndexForStreaming = displayMessages.length - 1;

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      data-hypha-room-id={roomId?.trim() || undefined}
    >
      {showUnreadBanner &&
      firstUnreadMeta.dateLabel &&
      firstUnreadMeta.timeLabel ? (
        <div
          role="status"
          aria-live="polite"
          className="shrink-0 border-b border-border bg-muted/40 px-4 py-2.5"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
              {unreadNotificationCount <= 0
                ? t('unreadBannerSince', {
                    date: firstUnreadMeta.dateLabel,
                    time: firstUnreadMeta.timeLabel,
                  })
                : unreadCountIsCapped || unreadNotificationCount >= 100
                ? t('unreadBannerCapped', {
                    date: firstUnreadMeta.dateLabel,
                    time: firstUnreadMeta.timeLabel,
                  })
                : t('unreadBannerCount', {
                    count: unreadNotificationCount,
                    date: firstUnreadMeta.dateLabel,
                    time: firstUnreadMeta.timeLabel,
                  })}
            </p>
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              size="sm"
              className="h-8 shrink-0 px-3 text-xs"
              onClick={() => {
                onMarkAsReadFromBanner?.();
              }}
            >
              {t('markAsRead')}
            </Button>
          </div>
        </div>
      ) : null}

      <div
        ref={containerRef}
        onScroll={() => {
          const el = containerRef.current;
          if (!el) return;
          const threshold = 80;
          const distanceFromBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight;
          const atBottom = distanceFromBottom <= threshold;
          if (stickToBottomRef.current !== atBottom) {
            stickToBottomRef.current = atBottom;
            onTimelineAtBottomChange?.(atBottom);
          }
        }}
        className="narrow-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-3"
      >
        {/* Top padding keeps the floating action bar from clipping at the edge. */}
        <div className="flex flex-col gap-2 pt-3">
          {messages.length > 0 || hasMoreOlderMessages ? (
            <div
              ref={topSentinelRef}
              className="flex min-h-8 flex-col items-center justify-center gap-1 py-1"
            >
              {hasMoreOlderMessages ? (
                loadingOlderMessages ? (
                  <div
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin text-[color:var(--space-accent,#4a65d8)]"
                      aria-hidden
                    />
                    {t('loadingOlderMessages')}
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      lastAutoLoadAddedEventsRef.current = undefined;
                      void onLoadOlderMessages?.('manual');
                    }}
                  >
                    {t('loadOlderMessages')}
                  </Button>
                )
              ) : (
                <p className="text-center text-[11px] text-muted-foreground">
                  {t('historyStartReached')}
                </p>
              )}
            </div>
          ) : null}
          {timelineRows.map((row) => {
            if (row.kind === 'date') {
              return (
                <HumanChatPanelDateSeparator
                  key={row.key}
                  label={formatDateDividerLabel(row.date, formatter)}
                />
              );
            }
            if (row.kind === 'unread') {
              return <HumanChatPanelUnreadDivider key={row.key} />;
            }

            const msg = row.message;
            const index = displayMessages.findIndex((m) => m.id === msg.id);
            const canInteract = !msg.isSynthetic;
            const isActionBarVisible =
              lockActionMessageId === msg.id ||
              (hoverActionMessageId === msg.id && lockActionMessageId == null);

            return (
              <HumanChatPanelMessageBubble
                key={row.key}
                message={msg}
                roomId={roomId}
                currentUserId={currentUserId}
                currentUserAvatarUrl={currentUserAvatarUrl}
                resolveReactionReactorLabel={resolveReactionReactorLabel}
                resolveMatrixMemberLabel={resolveMatrixMemberLabel}
                resolveSenderDisplayLabel={resolveSenderDisplayLabel}
                isActionBarVisible={isActionBarVisible}
                jumpFlash={jumpFlashMessageId === msg.id}
                unreadBoundary={row.isFirstUnread}
                isTouchComposer={isTouchComposer}
                onRowPointerEnter={
                  isTouchComposer
                    ? undefined
                    : () => {
                        leaveWhileLockedRef.current = null;
                        setHoverActionMessageId(msg.id);
                      }
                }
                onRowPointerLeave={
                  isTouchComposer
                    ? undefined
                    : () => {
                        if (lockActionMessageIdRef.current === msg.id) {
                          leaveWhileLockedRef.current = msg.id;
                          return;
                        }
                        setHoverActionMessageId((current) =>
                          current === msg.id ? null : current,
                        );
                      }
                }
                onRowActivate={
                  isTouchComposer
                    ? () => {
                        leaveWhileLockedRef.current = null;
                        setHoverActionMessageId((current) =>
                          current === msg.id ? null : msg.id,
                        );
                        setLockActionMessageId(null);
                      }
                    : undefined
                }
                onHoverReactPickerOpenChange={(open) => {
                  if (open) {
                    setLockActionMessageId(msg.id);
                    return;
                  }
                  setLockActionMessageId((cur) =>
                    cur === msg.id ? null : cur,
                  );
                  if (leaveWhileLockedRef.current === msg.id) {
                    leaveWhileLockedRef.current = null;
                    setHoverActionMessageId((current) =>
                      current === msg.id ? null : current,
                    );
                  }
                }}
                isStreaming={
                  msg.role === 'member' &&
                  isStreaming &&
                  index === messageIndexForStreaming
                }
                onReply={
                  canInteract && onReply ? () => onReply(msg.id) : undefined
                }
                onJumpToOriginal={
                  canInteract && onJumpToOriginalMessage && msg.replyTo?.eventId
                    ? () => onJumpToOriginalMessage(msg.replyTo!.eventId!)
                    : undefined
                }
                onEdit={
                  canInteract &&
                  onEditMessage &&
                  msg.role === 'user' &&
                  !msg.sendPending
                    ? () => onEditMessage(msg.id)
                    : undefined
                }
                onDeleteMessage={
                  canInteract && onDeleteMessage ? onDeleteMessage : undefined
                }
                onReact={
                  canInteract && onToggleReaction
                    ? (emoji: string) => onToggleReaction(msg.id, emoji)
                    : undefined
                }
                onCancelSendPending={
                  msg.sendPending && onCancelSendPending
                    ? onCancelSendPending
                    : undefined
                }
              />
            );
          })}
        </div>
        <div
          ref={bottomSentinelRef}
          className="h-1 w-full shrink-0"
          aria-hidden
        />
      </div>
    </div>
  );
}
