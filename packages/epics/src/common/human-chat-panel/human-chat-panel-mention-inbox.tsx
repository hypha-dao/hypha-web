'use client';

import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import { useTranslations } from 'next-intl';

import {
  isRedactedRoomMessageEvent,
  parseMentionUserIdsFromWireContent,
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

    const ids = parseMentionUserIdsFromWireContent(ev.getContent());
    if (!ids?.includes(currentUserId)) continue;

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

  const rows =
    client && roomId && currentUserId
      ? gatherMentionEvents(client, roomId, currentUserId, 80)
      : [];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
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

              return (
                <li key={id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted/70"
                    onClick={() => onSelectMessage(id)}
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
    </div>
  );
}
