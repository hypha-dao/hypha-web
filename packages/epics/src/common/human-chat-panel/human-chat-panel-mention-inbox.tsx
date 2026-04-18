'use client';

import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import { Bell, Settings } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import {
  isRedactedRoomMessageEvent,
  parseMentionUserIdsFromWireContent,
  stripMatrixReplyFallback,
} from '@hypha-platform/core/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@hypha-platform/ui';

export type HumanChatPanelMentionInboxProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notificationCentreHref: string;
  client: MatrixClient | null;
  roomId: string | null;
  currentUserId: string | null;
  unreadCount: number;
  countIsCapped: boolean;
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

    const ids = parseMentionUserIdsFromWireContent(ev.getContent());
    if (!ids?.includes(currentUserId)) continue;

    out.push(ev);
  }
  return out;
}

export function HumanChatPanelMentionInbox({
  open,
  onOpenChange,
  notificationCentreHref,
  client,
  roomId,
  currentUserId,
  unreadCount,
  countIsCapped,
  resolveMemberLabel,
  onSelectMessage,
}: HumanChatPanelMentionInboxProps) {
  const t = useTranslations('HumanChatPanel');

  const rows =
    open && client && roomId && currentUserId
      ? gatherMentionEvents(client, roomId, currentUserId, 80)
      : [];

  const badgeLabel =
    unreadCount <= 0
      ? undefined
      : countIsCapped || unreadCount >= 100
      ? '99+'
      : String(unreadCount);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
          showClose
          closeLabel={t('mentionInboxClose')}
        >
          <SheetHeader className="space-y-1 border-b border-border px-4 pb-3 pt-4">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="text-left text-base font-semibold">
                {t('mentionInboxTitle')}
              </SheetTitle>
              <Link
                href={notificationCentreHref}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={t('mentionInboxNotificationSettings')}
                title={t('mentionInboxNotificationSettings')}
              >
                <Settings className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            {rows.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">
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

                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className="flex w-full flex-col gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted/70"
                        onClick={() => {
                          onOpenChange(false);
                          onSelectMessage(id);
                        }}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate text-xs font-semibold text-foreground">
                            {senderLabel}
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {new Date(ts).toLocaleString(undefined, {
                              hour: 'numeric',
                              minute: '2-digit',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        <p className="border-l-2 border-border pl-2 text-xs leading-snug text-muted-foreground">
                          {excerpt || t('mentionInboxNoPreview')}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <button
        type="button"
        className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={
          unreadCount > 0
            ? t('mentionInboxBellAria', {
                count: countIsCapped ? '99+' : unreadCount,
              })
            : t('mentionInboxBellAriaEmpty')
        }
        title={t('mentionInboxTitle')}
        onClick={() => onOpenChange(true)}
      >
        <Bell className="h-3.5 w-3.5" aria-hidden />
        {badgeLabel != null && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-semibold leading-none text-primary-foreground">
            {badgeLabel}
          </span>
        )}
      </button>
    </>
  );
}
