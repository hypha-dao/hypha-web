'use client';

import { useMemo, type KeyboardEvent, type ReactNode } from 'react';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import { Bell, ArrowUpRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Skeleton } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  getMessageReplaceTargetEventId,
  isRedactedRoomMessageEvent,
  contentMentionsMatrixUser,
  stripMatrixReplyFallback,
  useJwt,
  usePersonBySub,
  useUserPrivyIdByMatrixId,
} from '@hypha-platform/core/client';
import { renderTextWithMentions } from './human-chat-panel-message-bubble';
import {
  looksLikeTechnicalMatrixDisplayName,
  matrixUserIdToCanonicalPrivySub,
} from './matrix-room-member-display';
import {
  gatherAggregatedMentionPreviews,
  replacementEventsByRootId,
  wireContentForMentionParse,
} from './matrix-chat-unread';

export type HumanChatPanelMentionTabProps = {
  client: MatrixClient | null;
  roomId: string | null;
  currentUserId: string | null;
  resolveMemberLabel: (matrixUserId: string) => string;
  /** `roomId` omitted = current space chat room. */
  onSelectMessage: (eventId: string, fromRoomId?: string) => void;
  /** When true, list @-mentions from all joined Matrix rooms with room labels. */
  aggregatedMentions?: boolean;
};

function excerptFromRoomMessage(
  ev: MatrixEvent,
  replacementsByRootId?: Map<string, MatrixEvent[]>,
): string {
  const content = (
    replacementsByRootId
      ? wireContentForMentionParse(ev, replacementsByRootId)
      : ev.getContent()
  ) as { body?: string } | undefined;
  const raw = typeof content?.body === 'string' ? content.body : '';
  return stripMatrixReplyFallback(raw).trim().slice(0, 280);
}

function formatPersonDisplayName(p: {
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
}): string {
  const full = [p.name, p.surname].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (p.nickname?.trim()) return p.nickname.trim();
  return '';
}

/**
 * Sender line in @ inbox: match chat timeline — roster label first, then Hypha Person
 * when Matrix still exposes bridged Privy technical display names.
 */
function MentionInboxSenderName({
  matrixUserId,
  syncLabel,
}: {
  matrixUserId: string;
  syncLabel: string;
}) {
  const t = useTranslations('HumanChatPanel');
  const canonicalSub = matrixUserIdToCanonicalPrivySub(matrixUserId);
  const syncLooksTechnical = looksLikeTechnicalMatrixDisplayName(
    syncLabel,
    matrixUserId,
  );
  const hasFriendlySyncLabel =
    Boolean(syncLabel.trim()) &&
    syncLabel.trim() !== matrixUserId &&
    !syncLooksTechnical;
  const needsLinkLookup =
    Boolean(matrixUserId) && !canonicalSub && !hasFriendlySyncLabel;
  const needsPersonLookup =
    !hasFriendlySyncLabel && (Boolean(canonicalSub) || needsLinkLookup);

  const { privyUserId: linkedSub, isLoading: loadingLink } =
    useUserPrivyIdByMatrixId({
      matrixUserId: needsLinkLookup ? matrixUserId : undefined,
    });
  const resolvedSub = canonicalSub ?? linkedSub;
  const { user } = useAuthentication();
  const { jwt, isLoadingJwt } = useJwt();
  const { person, isLoading: loadingPerson } = usePersonBySub({
    sub: resolvedSub,
  });

  const text = useMemo(() => {
    const fromPerson = person ? formatPersonDisplayName(person) : '';
    if (fromPerson.trim()) return fromPerson;
    const fallback = syncLabel.trim();
    if (
      fallback &&
      !looksLikeTechnicalMatrixDisplayName(fallback, matrixUserId)
    ) {
      return fallback;
    }
    return t('unknownMember');
  }, [matrixUserId, person, syncLabel, t]);

  const jwtBlockingForPerson =
    Boolean(resolvedSub) &&
    ((user && isLoadingJwt && !jwt) || (!user && isLoadingJwt));
  const loading =
    needsPersonLookup &&
    ((needsLinkLookup && loadingLink) ||
      (Boolean(resolvedSub) && (loadingPerson || jwtBlockingForPerson)));

  if (loading) {
    return (
      <Skeleton
        className="inline-block align-baseline"
        loading
        width={120}
        height={14}
      />
    );
  }

  return <span className="truncate">{text}</span>;
}

function selectMentionRowKeyDown(e: KeyboardEvent, onSelect: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onSelect();
  }
}

function eventComesFromInteractiveChild(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest('a,button,[role="link"],[role="button"],[tabindex="0"]'),
    )
  );
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
  const replacementsByRootId = replacementEventsByRootId(events);
  const out: MatrixEvent[] = [];
  for (let i = events.length - 1; i >= 0 && out.length < limit; i--) {
    const ev = events[i];
    if (!ev) continue;
    if (ev.getType() !== EventType.RoomMessage) continue;
    if (!ev.getId()) continue;
    if (ev.getSender() === currentUserId) continue;
    if (isRedactedRoomMessageEvent(ev)) continue;
    if (getMessageReplaceTargetEventId(ev) != null) continue;

    if (
      !contentMentionsMatrixUser(
        wireContentForMentionParse(ev, replacementsByRootId),
        currentUserId,
      )
    ) {
      continue;
    }

    out.push(ev);
  }
  return out;
}

const MENTION_INBOX_ROW_CLASS =
  'group flex w-full cursor-pointer flex-col gap-1 rounded-xl border border-border/70 bg-card px-3 py-2.5 text-left text-foreground shadow-sm transition-[border-color,background-color,box-shadow] duration-150 hover:border-accent-8/80 hover:bg-muted/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-9/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const MENTION_INBOX_NAV_ICON_CLASS =
  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/80 text-muted-foreground shadow-sm transition-colors group-hover:border-accent-8/60 group-hover:bg-accent-2/80 group-hover:text-foreground';

function MentionInboxNavigateIcon({ label }: { label: string }) {
  return (
    <span className={MENTION_INBOX_NAV_ICON_CLASS} aria-hidden title={label}>
      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />
    </span>
  );
}

function MentionInboxRow({
  ariaLabel,
  navigateLabel,
  onNavigate,
  header,
  sender,
  excerpt,
}: {
  ariaLabel: string;
  navigateLabel: string;
  onNavigate: () => void;
  header?: ReactNode;
  sender: ReactNode;
  excerpt: ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={MENTION_INBOX_ROW_CLASS}
      aria-label={ariaLabel}
      onClick={(e) => {
        if (eventComesFromInteractiveChild(e.target)) return;
        onNavigate();
      }}
      onKeyDown={(e) => {
        if (eventComesFromInteractiveChild(e.target)) return;
        selectMentionRowKeyDown(e, onNavigate);
      }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          {header}
          <div className="flex items-baseline justify-between gap-2">
            {sender}
          </div>
          <div className="border-l-2 border-accent-8/70 pl-2 text-xs leading-relaxed text-foreground/90 [&_a]:break-all [&_a]:font-medium [&_a]:text-primary [&_a]:underline">
            {excerpt}
          </div>
        </div>
        <MentionInboxNavigateIcon label={navigateLabel} />
      </div>
    </div>
  );
}

/** Inline Mentions tab body (same panel as Chat / Members — no overlay). */
export function HumanChatPanelMentionTab({
  client,
  roomId,
  currentUserId,
  resolveMemberLabel,
  onSelectMessage,
  aggregatedMentions = false,
}: HumanChatPanelMentionTabProps) {
  const t = useTranslations('HumanChatPanel');
  const format = useFormatter();

  const aggregatedRows =
    aggregatedMentions && client && currentUserId
      ? gatherAggregatedMentionPreviews(client, currentUserId, 80)
      : [];

  const singleRoomTimeline =
    !aggregatedMentions && client && roomId
      ? client.getRoom(roomId)?.getLiveTimeline().getEvents() ?? []
      : [];
  const singleRoomReplacements = replacementEventsByRootId(singleRoomTimeline);

  const singleRoomRows =
    !aggregatedMentions && client && roomId && currentUserId
      ? gatherMentionEvents(client, roomId, currentUserId, 80)
      : [];

  const rows = aggregatedMentions ? aggregatedRows : singleRoomRows;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="narrow-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {(aggregatedMentions
          ? aggregatedRows.length
          : singleRoomRows.length) === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">
            {t('mentionInboxEmpty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {aggregatedMentions
              ? aggregatedRows.map((row) => {
                  const senderSyncLabel = resolveMemberLabel(row.senderId);
                  const navigateLabel = t('mentionInboxNavigateToMessage');
                  return (
                    <li key={`${row.roomId}:${row.eventId}`}>
                      <MentionInboxRow
                        ariaLabel={t('mentionInboxOpenConversation', {
                          room: row.roomDisplayName,
                        })}
                        navigateLabel={navigateLabel}
                        onNavigate={() =>
                          onSelectMessage(row.eventId, row.roomId)
                        }
                        header={
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="min-w-0 truncate text-[11px] font-medium text-foreground/70">
                              {row.roomDisplayName}
                            </span>
                            <span className="shrink-0 text-[11px] tabular-nums text-foreground/60">
                              {format.dateTime(new Date(row.timestamp), {
                                hour: 'numeric',
                                minute: '2-digit',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        }
                        sender={
                          <span className="min-w-0 truncate text-xs font-semibold text-foreground">
                            <MentionInboxSenderName
                              matrixUserId={row.senderId}
                              syncLabel={senderSyncLabel}
                            />
                          </span>
                        }
                        excerpt={
                          row.excerpt
                            ? renderTextWithMentions(
                                row.excerpt,
                                resolveMemberLabel,
                                true,
                              )
                            : t('mentionInboxNoPreview')
                        }
                      />
                    </li>
                  );
                })
              : singleRoomRows.map((ev) => {
                  const id = ev.getId();
                  const senderId = ev.getSender();
                  if (!id || !senderId) return null;
                  const excerpt = excerptFromRoomMessage(
                    ev,
                    singleRoomReplacements,
                  );
                  const senderSyncLabel = resolveMemberLabel(senderId);
                  const ts = ev.getTs();
                  const navigateLabel = t('mentionInboxNavigateToMessage');

                  return (
                    <li key={id}>
                      <MentionInboxRow
                        ariaLabel={navigateLabel}
                        navigateLabel={navigateLabel}
                        onNavigate={() => onSelectMessage(id)}
                        sender={
                          <>
                            <span className="min-w-0 truncate text-xs font-semibold text-foreground">
                              <MentionInboxSenderName
                                matrixUserId={senderId}
                                syncLabel={senderSyncLabel}
                              />
                            </span>
                            <span className="shrink-0 text-[11px] tabular-nums text-foreground/60">
                              {format.dateTime(new Date(ts), {
                                hour: 'numeric',
                                minute: '2-digit',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </>
                        }
                        excerpt={
                          excerpt
                            ? renderTextWithMentions(
                                excerpt,
                                resolveMemberLabel,
                                true,
                              )
                            : t('mentionInboxNoPreview')
                        }
                      />
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
};

export function HumanChatPanelMentionBell({
  unreadCount,
  countIsCapped,
  onOpenMentions,
  mentionsTabActive = false,
}: HumanChatPanelMentionBellProps) {
  const t = useTranslations('HumanChatPanel');

  const badgeLabel =
    unreadCount <= 0
      ? undefined
      : countIsCapped || unreadCount >= 100
      ? '99+'
      : String(unreadCount);

  return (
    <button
      type="button"
      className={cn(
        'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-9/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        mentionsTabActive
          ? 'border border-accent-9/40 bg-accent-9/18 text-foreground shadow-sm ring-1 ring-inset ring-accent-9/25 dark:border-accent-10/45 dark:bg-accent-9/22 dark:ring-accent-10/30'
          : 'border border-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/80 hover:text-foreground',
      )}
      aria-pressed={mentionsTabActive}
      aria-label={
        unreadCount > 0
          ? countIsCapped || unreadCount >= 100
            ? t('mentionInboxBellAriaCapped')
            : t('mentionInboxBellAria', { count: unreadCount })
          : t('mentionInboxBellAriaEmpty')
      }
      title={t('mentionInboxTitle')}
      onClick={onOpenMentions}
    >
      <Bell className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      {badgeLabel != null && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full border border-accent-9/35 bg-accent-9 px-0.5 text-[9px] font-semibold leading-none text-accent-contrast shadow-sm">
          {badgeLabel}
        </span>
      )}
    </button>
  );
}
