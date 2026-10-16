'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ClientEvent,
  EventType,
  UserEvent,
  type MatrixClient,
} from 'matrix-js-sdk';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';
import { isHyphaBotMatrixIdentity } from '../../common/human-chat-panel/matrix-room-member-display';
import type { Locale } from '@hypha-platform/i18n';
import { cn } from '@hypha-platform/ui-utils';
import {
  getMessageReplaceTargetEventId,
  isRedactedRoomMessageEvent,
  messageCountsByMatrixUser,
  messageCountsByPersonId,
  rankClosestContributors,
  useMatrix,
  useMatrixUserIdsByPersonIds,
  type ConversationSnapshot,
  type MemberIntelligence,
  type NamedRoomSnapshot,
} from '@hypha-platform/core/client';

import {
  presenceRank,
  readMemberPresence,
  type PresenceLevel,
} from './member-presence';
import { PersonAvatar } from './person-avatar';
import { PresenceDot } from './presence-dot';

type ClosestPerson = MemberIntelligence['connections'][number];

const VISIBLE_PEOPLE = 5;
const PORTRAIT_PX = 32;

type MemberHomeClosestProps = {
  lang: Locale;
  people: ClosestPerson[];
  fallbackName: string;
  onOpenChat: (person: ClosestPerson) => Promise<boolean>;
};

function sameCounts(left: Map<number, number>, right: Map<number, number>) {
  if (left.size !== right.size) return false;
  for (const [id, count] of left) {
    if (right.get(id) !== count) return false;
  }
  return true;
}

function personLabel(person: ClosestPerson, fallback: string) {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname || fallback;
}

/** Joined rooms, with the org bot left out so a direct chat stays two people. */
export function readJoinedPeopleRooms(client: MatrixClient): {
  conversations: ConversationSnapshot[];
  named: NamedRoomSnapshot[];
} {
  const botId = process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID?.trim() || null;
  const conversations: ConversationSnapshot[] = [];
  const named: NamedRoomSnapshot[] = [];

  for (const room of client.getRooms()) {
    if (room.getMyMembership() !== 'join') continue;
    const joinedUserIds = room
      .getJoinedMembers()
      .map((member) => member.userId)
      .filter((id) => id && id !== botId && !isHyphaBotMatrixIdentity(id));

    const messageSenderIds: string[] = [];
    for (const event of room.getLiveTimeline().getEvents()) {
      if (event.getType() !== EventType.RoomMessage) continue;
      if (isRedactedRoomMessageEvent(event)) continue;
      if (getMessageReplaceTargetEventId(event) != null) continue;
      const sender = event.getSender();
      if (!sender || sender === botId || isHyphaBotMatrixIdentity(sender)) {
        continue;
      }
      messageSenderIds.push(sender);
    }
    named.push({
      roomId: room.roomId,
      name: room.name ?? '',
      joinedUserIds,
      lastActiveTs: room.getLastActiveTimestamp(),
      messageCount: messageSenderIds.length,
    });
    conversations.push({ joinedUserIds, messageSenderIds });
  }

  return { conversations, named };
}

function samePresence(
  left: Map<number, PresenceLevel>,
  right: Map<number, PresenceLevel>,
) {
  if (left.size !== right.size) return false;
  for (const [id, level] of left) {
    if (right.get(id) !== level) return false;
  }
  return true;
}

export function MemberHomeClosest({
  lang,
  people,
  fallbackName,
  onOpenChat,
}: MemberHomeClosestProps) {
  const t = useTranslations('MemberHome');
  const router = useRouter();
  const { closeCoherenceChat, openHumanChatPanel } = useHumanChatPanel();
  const matrix = useMatrix();
  const [messageCounts, setMessageCounts] = useState<Map<number, number>>(
    () => new Map(),
  );
  const [presenceById, setPresenceById] = useState<Map<
    number,
    PresenceLevel
  > | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const openingRef = useRef(false);
  const personIds = useMemo(() => people.map((person) => person.id), [people]);
  const { personIdToMatrixUserId, isLoading: matrixIdsLoading } =
    useMatrixUserIdsByPersonIds({
      personIds,
    });

  useEffect(() => {
    const client = matrix.client;
    if (!client || !matrix.isAuthenticated || personIds.length === 0) {
      setMessageCounts((current) => (current.size === 0 ? current : new Map()));
      return;
    }

    let timer = 0;
    const recompute = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const selfId = client.getUserId() ?? '';
        const { conversations } = readJoinedPeopleRooms(client);
        const next = messageCountsByPersonId(
          messageCountsByMatrixUser(conversations, selfId),
          personIdToMatrixUserId,
        );
        setMessageCounts((current) =>
          sameCounts(current, next) ? current : next,
        );
      }, 250);
    };

    recompute();
    client.on(ClientEvent.Sync, recompute);
    return () => {
      window.clearTimeout(timer);
      client.removeListener(ClientEvent.Sync, recompute);
    };
  }, [
    matrix.client,
    matrix.isAuthenticated,
    personIdToMatrixUserId,
    personIds.length,
  ]);

  useEffect(() => {
    const client = matrix.client;
    if (personIds.length === 0) {
      setPresenceById((current) =>
        current && current.size === 0 ? current : new Map(),
      );
      return;
    }
    if (!client || !matrix.isAuthenticated || matrixIdsLoading) return;

    let cancelled = false;
    let timer = 0;
    const recompute = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void (async () => {
          const next = new Map<number, PresenceLevel>();
          await Promise.all(
            personIds.map(async (personId) => {
              const matrixUserId = personIdToMatrixUserId[personId];
              if (!matrixUserId) {
                next.set(personId, 'offline');
                return;
              }
              next.set(
                personId,
                await readMemberPresence(client, matrixUserId),
              );
            }),
          );
          if (cancelled) return;
          setPresenceById((current) =>
            current && samePresence(current, next) ? current : next,
          );
        })();
      }, 250);
    };

    recompute();
    const interval = window.setInterval(recompute, 30_000);
    client.on(UserEvent.Presence, recompute);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(interval);
      client.removeListener(UserEvent.Presence, recompute);
    };
  }, [
    matrix.client,
    matrix.isAuthenticated,
    matrixIdsLoading,
    personIdToMatrixUserId,
    personIds,
  ]);

  const ranked = useMemo(
    () => rankClosestContributors(people, messageCounts, VISIBLE_PEOPLE),
    [messageCounts, people],
  );
  const visiblePeople = useMemo(() => {
    if (!presenceById) return ranked.people;
    return [...ranked.people].sort((left, right) => {
      const byPresence =
        presenceRank(presenceById.get(left.id) ?? 'offline') -
        presenceRank(presenceById.get(right.id) ?? 'offline');
      if (byPresence !== 0) return byPresence;
      return (
        (messageCounts.get(right.id) ?? 0) - (messageCounts.get(left.id) ?? 0)
      );
    });
  }, [messageCounts, presenceById, ranked.people]);

  const label = t('sensingAround');
  const rest = Math.max(0, people.length - visiblePeople.length);

  if (people.length === 0) return null;

  return (
    <nav aria-label={label} className="mt-1 min-w-0 max-w-full pb-3">
      <p className="text-1 tracking-[0.12em] text-neutral-11 uppercase">
        {label}
      </p>
      {presenceById == null ? (
        <div className="mt-2 flex gap-2" aria-hidden>
          {Array.from(
            { length: Math.min(VISIBLE_PEOPLE, people.length) },
            (_, index) => (
              <span
                key={index}
                className="animate-pulse rounded-full bg-neutral-3"
                style={{ width: PORTRAIT_PX, height: PORTRAIT_PX }}
              />
            ),
          )}
        </div>
      ) : visiblePeople.length === 0 ? (
        <p className="mt-2 text-1 text-neutral-11">{t('sensingAroundEmpty')}</p>
      ) : (
        <ul className="mt-2 flex max-w-full flex-wrap items-center gap-2">
          {visiblePeople.map((person, index) => {
            const name = personLabel(person, fallbackName);
            const href = person.slug ? `/${lang}/profile/${person.slug}` : null;
            const hover =
              ranked.basis === 'sharedSpaces'
                ? `${name}. ${t('sharedSpaces', {
                    count: person.sharedSpaceCount,
                  })}`
                : name;
            const opening = openingId === person.id;
            const presence = presenceById.get(person.id) ?? 'offline';
            const portrait = (
              <span className="relative inline-flex">
                <span
                  className={cn(
                    'inline-flex rounded-full',
                    index === 0 && 'ring-1 ring-foreground',
                  )}
                >
                  <PersonAvatar
                    avatarSrc={person.avatarUrl ?? undefined}
                    userName={name}
                    size="md"
                    shape="circle"
                  />
                </span>
                <PresenceDot level={presence} size="sm" />
              </span>
            );

            return (
              <li key={person.id} className="flex shrink-0 items-center">
                {href ? (
                  <Link
                    href={href}
                    title={hover}
                    aria-label={t('openPerson', { name })}
                    aria-busy={opening || undefined}
                    className={cn(
                      'inline-flex rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      opening && 'opacity-60',
                    )}
                    onClick={(event) => {
                      if (
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey ||
                        event.button !== 0
                      ) {
                        return;
                      }
                      event.preventDefault();
                      if (openingRef.current) return;
                      openingRef.current = true;
                      setOpeningId(person.id);
                      void onOpenChat(person)
                        .then((opened) => {
                          if (!opened) router.push(href);
                        })
                        .finally(() => {
                          openingRef.current = false;
                          setOpeningId(null);
                        });
                    }}
                  >
                    {portrait}
                  </Link>
                ) : (
                  <span title={hover} className="inline-flex">
                    {portrait}
                  </span>
                )}
              </li>
            );
          })}
          {rest > 0 ? (
            <li>
              <Link
                href={`/${lang}/connections`}
                aria-label={t('seeMore')}
                className="flex items-center justify-center rounded-full border border-neutral-7 text-1 text-neutral-12 xl:hidden"
                style={{ width: PORTRAIT_PX, height: PORTRAIT_PX }}
              >
                {t('sensingMore', { count: rest })}
              </Link>
              <button
                type="button"
                aria-label={t('seeMore')}
                className="hidden items-center justify-center rounded-full border border-neutral-7 text-1 text-neutral-12 xl:flex"
                style={{ width: PORTRAIT_PX, height: PORTRAIT_PX }}
                onClick={() => {
                  closeCoherenceChat();
                  openHumanChatPanel();
                }}
              >
                {t('sensingMore', { count: rest })}
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </nav>
  );
}
