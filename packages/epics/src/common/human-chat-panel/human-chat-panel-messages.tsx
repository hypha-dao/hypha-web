'use client';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useFormatter, useTranslations } from 'next-intl';

import { Button } from '@hypha-platform/ui';

import { HumanChatPanelDateSeparator } from './human-chat-panel-date-separator';
import { HumanChatPanelUnreadDivider } from './human-chat-panel-unread-divider';
import { HumanChatPanelMessageBubble } from './human-chat-panel-message-bubble';
import type { ChatPanelAttachmentMedia } from './chat-panel-media-types';

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
  avatarUrl?: string;
  timestamp?: Date;
  formattedContentHtml?: string;
  reactions?: Array<{
    emoji: string;
    count: number;
    includesCurrentUser?: boolean;
    reactorUserIds?: string[];
  }>;
  replyTo?: {
    authorLabel: string;
    excerpt?: string;
    /** Matrix MXID of quoted author (for avatar refresh). */
    sourceUserId?: string;
    authorAvatarUrl?: string;
  };
};

function dayKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDividerLabel(
  date: Date,
  formatter: ReturnType<typeof useFormatter>,
): string {
  return formatter.dateTime(date, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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

  for (const msg of messages) {
    const ts = msg.timestamp;
    if (ts) {
      const dk = dayKeyLocal(ts);
      if (dk !== prevDay) {
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
  onReply?: (messageId: string) => void;
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
  /** User clicked “Mark as read” in the banner. */
  onMarkAsReadFromBanner?: () => void;
  /** Scroll this Matrix event id into view when set (e.g. mention inbox). */
  scrollTargetEventId?: string | null;
  onConsumedScrollTarget?: () => void;
  onScrollTargetNotFound?: (eventId: string) => void;
};

export function HumanChatPanelMessages({
  messages,
  isStreaming = false,
  roomId,
  currentUserId,
  currentUserAvatarUrl,
  onReply,
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
  onMarkAsReadFromBanner,
  scrollTargetEventId,
  onConsumedScrollTarget,
  onScrollTargetNotFound,
}: HumanChatPanelMessagesProps) {
  const t = useTranslations('HumanChatPanel');
  const formatter = useFormatter();

  const welcomeMessage: UIMessage = {
    id: 'welcome',
    role: 'member',
    isSynthetic: true,
    parts: [{ type: 'text', text: t('welcome') }],
    senderName: t('systemSender'),
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);
  const prevLastIdRef = useRef<string | null>(null);
  const stickToBottomRef = useRef(true);
  const initialUnreadScrollDoneRef = useRef(false);
  const prevRoomIdRef = useRef<string | null | undefined>(undefined);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  /** Avoid calling onConsumedScrollTarget repeatedly while scrollTargetEventId is unchanged. */
  const scrollTargetConsumedRef = useRef<string | null>(null);
  /** Retry deep-link target lookup across timeline growth before falling back. */
  const scrollTargetMissCountRef = useRef(0);
  const scrollTargetMissHandledRef = useRef<string | null>(null);

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

  const displayMessages = messages.length > 0 ? messages : [welcomeMessage];

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
    const ts = target?.timestamp;
    if (!ts) {
      return {
        dateLabel: null as string | null,
        timeLabel: null as string | null,
      };
    }
    return {
      dateLabel: formatDateDividerLabel(ts, formatter),
      timeLabel: formatter.dateTime(ts, {
        timeStyle: 'short',
        dateStyle: undefined,
      }),
    };
  }, [displayMessages, firstUnreadMessageId, formatter]);

  const showUnreadBanner =
    Boolean(firstUnreadMessageId) &&
    Boolean(firstUnreadMeta.dateLabel && firstUnreadMeta.timeLabel);

  const scrollToUnread = useCallback(() => {
    if (!firstUnreadMessageId) return;
    const escaped =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(firstUnreadMessageId)
        : firstUnreadMessageId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const el = document.querySelector(
      `[data-matrix-event-id="${escaped}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    stickToBottomRef.current = false;
  }, [firstUnreadMessageId]);

  useEffect(() => {
    if (roomId !== prevRoomIdRef.current) {
      prevRoomIdRef.current = roomId;
      initialUnreadScrollDoneRef.current = false;
    }
  }, [roomId]);

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
    const prevLen = prevLenRef.current;
    const prevLastId = prevLastIdRef.current;

    const appended =
      len > 0 &&
      lastId != null &&
      (prevLen === 0 || (len >= prevLen && lastId !== prevLastId));

    const shouldScrollUnread =
      Boolean(firstUnreadMessageId) &&
      !initialUnreadScrollDoneRef.current &&
      messages.some((m) => m.id === firstUnreadMessageId);

    if (shouldScrollUnread) {
      initialUnreadScrollDoneRef.current = true;
      stickToBottomRef.current = false;
      window.requestAnimationFrame(() => {
        scrollToUnread();
      });
      prevLenRef.current = len;
      prevLastIdRef.current = lastId;
      return;
    }

    if (appended) {
      stickToBottomRef.current = true;
    }

    if (stickToBottomRef.current || isStreaming) {
      container.scrollTop = container.scrollHeight;
    }

    prevLenRef.current = len;
    prevLastIdRef.current = lastId;
  }, [messages, isStreaming, firstUnreadMessageId, scrollToUnread]);

  useLayoutEffect(() => {
    if (!scrollTargetEventId) return;
    if (scrollTargetConsumedRef.current === scrollTargetEventId) return;
    const root = containerRef.current;
    if (!root) return;
    const esc =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(scrollTargetEventId)
        : scrollTargetEventId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const row = root.querySelector(`[data-matrix-event-id="${esc}"]`);
    if (row instanceof HTMLElement) {
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      stickToBottomRef.current = false;
      scrollTargetConsumedRef.current = scrollTargetEventId;
      scrollTargetMissCountRef.current = 0;
      scrollTargetMissHandledRef.current = null;
      onConsumedScrollTarget?.();
      return;
    }

    scrollTargetMissCountRef.current += 1;
    if (
      scrollTargetMissCountRef.current >= 12 &&
      scrollTargetMissHandledRef.current !== scrollTargetEventId
    ) {
      scrollTargetMissHandledRef.current = scrollTargetEventId;
      onScrollTargetNotFound?.(scrollTargetEventId);
    }
  }, [
    scrollTargetEventId,
    onConsumedScrollTarget,
    onScrollTargetNotFound,
    timelineRows.length,
  ]);

  useEffect(() => {
    const root = containerRef.current;
    const sentinel = bottomSentinelRef.current;
    if (!root || !sentinel || !onReachedTimelineBottom) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            onReachedTimelineBottom();
          }
        }
      },
      { root, threshold: 0.25 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [onReachedTimelineBottom, timelineRows.length]);

  const messageIndexForStreaming = displayMessages.length - 1;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {showUnreadBanner &&
      firstUnreadMeta.dateLabel &&
      firstUnreadMeta.timeLabel ? (
        <div className="border-b border-border bg-primary px-3 py-2 text-primary-foreground shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 text-xs font-medium leading-snug">
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
              size="sm"
              className="h-7 shrink-0 border-0 bg-primary-foreground/15 text-xs text-primary-foreground hover:bg-primary-foreground/25"
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
          stickToBottomRef.current = distanceFromBottom <= threshold;
        }}
        className="narrow-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-3 py-3"
      >
        <div className="flex flex-col gap-4">
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
                unreadBoundary={row.isFirstUnread}
                onRowPointerEnter={() => {
                  leaveWhileLockedRef.current = null;
                  setHoverActionMessageId(msg.id);
                }}
                onRowPointerLeave={() => {
                  if (lockActionMessageIdRef.current === msg.id) {
                    leaveWhileLockedRef.current = msg.id;
                    return;
                  }
                  setHoverActionMessageId((current) =>
                    current === msg.id ? null : current,
                  );
                }}
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
