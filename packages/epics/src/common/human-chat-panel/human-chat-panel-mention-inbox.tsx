'use client';

import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import { Bell, BellOff } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

import {
  getMessageReplaceTargetEventId,
  isRedactedRoomMessageEvent,
  contentMentionsMatrixUser,
  stripMatrixReplyFallback,
} from '@hypha-platform/core/client';

export type HumanChatPanelMentionTabProps = {
  client: MatrixClient | null;
  roomId: string | null;
  currentUserId: string | null;
  resolveMemberLabel: (matrixUserId: string) => string;
  onSelectMessage: (eventId: string) => void;
};

function excerptFromRoomMessage(ev: MatrixEvent): string {
  const content = ev.getContent() as { body?: string } | undefined;
  const raw = typeof content?.body === 'string' ? content.body : '';
  return stripMatrixReplyFallback(raw).trim().slice(0, 280);
}

function gatherMentionEvents(
  client: MatrixClient,
  roomId: string,
  currentUserId: string,
  limit: number,
): MatrixEvent[] {
  const room = client.getRoom(roomId);
  if (!room) return [];

  const events = room.getLiveTimeline().getEvents();
  const out: MatrixEvent[] = [];
  for (let i = events.length - 1; i >= 0 && out.length < limit; i--) {
    const ev = events[i];
    if (!ev) continue;
    if (ev.getType() !== EventType.RoomMessage) continue;
    if (!ev.getId()) continue;
    if (ev.getSender() === currentUserId) continue;
    if (isRedactedRoomMessageEvent(ev)) continue;
    if (getMessageReplaceTargetEventId(ev) != null) continue;

    if (!contentMentionsMatrixUser(ev.getContent(), currentUserId)) continue;

    out.push(ev);
  }
  return out;
}

/** Inline Mentions tab body (same panel as Chat / Members — no overlay). */
export function HumanChatPanelMentionTab({
  client,
  roomId,
  currentUserId,
  resolveMemberLabel,
  onSelectMessage,
}: HumanChatPanelMentionTabProps) {
  const t = useTranslations('HumanChatPanel');
  const format = useFormatter();

  const rows =
    client && roomId && currentUserId
      ? gatherMentionEvents(client, roomId, currentUserId, 80)
      : [];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="narrow-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {rows.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">
            {t('mentionInboxEmpty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((ev) => {
              const id = ev.getId();
              const senderId = ev.getSender();
              if (!id || !senderId) return null;
              const excerpt = excerptFromRoomMessage(ev);
              const senderLabel = resolveMemberLabel(senderId);
              const ts = ev.getTs();
              const tsDate = Number.isFinite(ts) ? new Date(ts) : null;

              return (
                <li key={id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1 rounded-xl border border-border/70 bg-muted/35 px-3 py-2.5 text-left shadow-sm transition-[border-color,background-color,box-shadow] duration-150 hover:border-accent-8/80 hover:bg-accent-2/90 hover:shadow-md"
                    onClick={() => onSelectMessage(id)}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-xs font-semibold text-foreground">
                        {senderLabel}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {tsDate
                          ? format.dateTime(tsDate, {
                              hour: 'numeric',
                              minute: '2-digit',
                              month: 'short',
                              day: 'numeric',
                            })
                          : ''}
                      </span>
                    </div>
                    <p className="border-l-2 border-accent-8/70 pl-2 text-xs leading-snug text-muted-foreground">
                      {excerpt || t('mentionInboxNoPreview')}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Compact bell for the chat panel top row: opens Mentions tab (same unread count as tabs). */
export type HumanChatPanelMentionBellProps = {
  unreadCount: number;
  countIsCapped: boolean;
  onOpenMentions: () => void;
  /** True when the Mentions tab is active — bell icon uses white on accent. */
  mentionsTabActive?: boolean;
  /**
   * When true, a **click** on the bell toggles call join chime (storage-backed).
   * Open the Mentions **tab** for the @ inbox; the bell no longer opens it while this is active.
   */
  callJoinRingControlsActive?: boolean;
  callJoinAlertsUnmuted?: boolean;
  onCallJoinAlertsUnmutedChange?: (unmuted: boolean) => void;
};

export function HumanChatPanelMentionBell({
  unreadCount,
  countIsCapped,
  onOpenMentions,
  mentionsTabActive = false,
  callJoinRingControlsActive = false,
  callJoinAlertsUnmuted = true,
  onCallJoinAlertsUnmutedChange,
}: HumanChatPanelMentionBellProps) {
  const t = useTranslations('HumanChatPanel');
  const callRingControls =
    callJoinRingControlsActive && onCallJoinAlertsUnmutedChange;

  if (
    process.env.NODE_ENV === 'development' &&
    callJoinRingControlsActive &&
    !onCallJoinAlertsUnmutedChange
  ) {
    console.warn(
      'HumanChatPanelMentionBell: callJoinRingControlsActive requires onCallJoinAlertsUnmutedChange',
    );
  }

  const badgeLabel =
    unreadCount <= 0
      ? undefined
      : countIsCapped || unreadCount >= 100
      ? '99+'
      : String(unreadCount);

  const showRingOff = callRingControls && !callJoinAlertsUnmuted;
  const ringLabel = callJoinAlertsUnmuted
    ? t('callJoinCallAlertsMuteAction')
    : t('callJoinCallAlertsUnmuteAction');

  return (
    <button
      type="button"
      className={cn(
        'relative flex h-7 shrink-0 items-center justify-center rounded-lg border text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-9/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        showRingOff ? 'min-w-0 gap-1 px-1.5 pe-2' : 'w-7',
        mentionsTabActive
          ? 'border border-accent-9/40 bg-accent-9/18 text-foreground shadow-sm ring-1 ring-inset ring-accent-9/25 dark:border-accent-10/45 dark:bg-accent-9/22 dark:ring-accent-10/30'
          : 'border border-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/80 hover:text-foreground',
      )}
      aria-pressed={
        callRingControls ? !callJoinAlertsUnmuted : mentionsTabActive
      }
      aria-label={
        callRingControls
          ? callJoinAlertsUnmuted
            ? t('mentionInboxBellCallRingUnmutedAria')
            : t('mentionInboxBellCallRingMutedAria')
          : unreadCount > 0
          ? countIsCapped || unreadCount >= 100
            ? t('mentionInboxBellAriaCapped')
            : t('mentionInboxBellAria', { count: unreadCount })
          : t('mentionInboxBellAriaEmpty')
      }
      title={
        callRingControls
          ? `${t('mentionInboxTitle')}. ${ringLabel}`
          : t('mentionInboxTitle')
      }
      onClick={() => {
        if (callRingControls) {
          onCallJoinAlertsUnmutedChange(!callJoinAlertsUnmuted);
          return;
        }
        onOpenMentions();
      }}
    >
      {showRingOff ? (
        <BellOff
          className="h-3.5 w-3.5 shrink-0 text-foreground/90"
          strokeWidth={2.25}
          aria-hidden
        />
      ) : (
        <Bell className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      )}
      {showRingOff && (
        <span className="max-w-[3.5rem] truncate text-[10px] font-semibold leading-none text-foreground/90">
          {t('callJoinCallAlertsMutedShort')}
        </span>
      )}
      {badgeLabel != null && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full border border-accent-9/35 bg-accent-9 px-0.5 text-[9px] font-semibold leading-none text-accent-contrast shadow-sm">
          {badgeLabel}
        </span>
      )}
    </button>
  );
}
