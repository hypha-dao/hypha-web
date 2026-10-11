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

import { PersonAvatar } from './person-avatar';
import { isPersonRole, PersonRoleBadge } from './person-badges';

type ClosestPerson = MemberIntelligence['connections'][number];

const VISIBLE_PEOPLE = 5;

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
      .filter((id) => id && id !== botId);
    named.push({
      roomId: room.roomId,
      name: room.name ?? '',
      joinedUserIds,
    });

    const messageSenderIds: string[] = [];
    for (const event of room.getLiveTimeline().getEvents()) {
      if (event.getType() !== EventType.RoomMessage) continue;
      if (isRedactedRoomMessageEvent(event)) continue;
      if (getMessageReplaceTargetEventId(event) != null) continue;
      const sender = event.getSender();
      if (!sender || sender === botId) continue;
      messageSenderIds.push(sender);
    }
    conversations.push({ joinedUserIds, messageSenderIds });
  }

  return { conversations, named };
}

function sameIds(left: Set<number>, right: Set<number>) {
  if (left.size !== right.size) return false;
  for (const id of left) {
    if (!right.has(id)) return false;
  }
  return true;
}

/** Matrix presence `online` is set while the Hypha client is signed in. */
async function isSignedInNow(
  client: MatrixClient,
  matrixUserId: string,
): Promise<boolean> {
  try {
    const status = await client.getPresence(matrixUserId);
    return status.presence === 'online' || Boolean(status.currently_active);
  } catch {
    return false;
  }
}

export function MemberHomeClosest({
  lang,
  people,
  fallbackName,
  onOpenChat,
}: MemberHomeClosestProps) {
  const t = useTranslations('MemberHome');
  const router = useRouter();
  const matrix = useMatrix();
  const [messageCounts, setMessageCounts] = useState<Map<number, number>>(
    () => new Map(),
  );
  const [onlineIds, setOnlineIds] = useState<Set<number> | null>(null);
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
      setOnlineIds((current) =>
        current && current.size === 0 ? current : new Set(),
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
          const next = new Set<number>();
          await Promise.all(
            personIds.map(async (personId) => {
              const matrixUserId = personIdToMatrixUserId[personId];
              if (!matrixUserId) return;
              if (await isSignedInNow(client, matrixUserId)) next.add(personId);
            }),
          );
          if (cancelled) return;
          setOnlineIds((current) =>
            current && sameIds(current, next) ? current : next,
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

  const onlinePeople = useMemo(
    () =>
      onlineIds ? people.filter((person) => onlineIds.has(person.id)) : [],
    [onlineIds, people],
  );
  const ranked = useMemo(
    () => rankClosestContributors(onlinePeople, messageCounts, VISIBLE_PEOPLE),
    [messageCounts, onlinePeople],
  );

  const label = t('sensingAround');
  const rest = Math.max(0, onlinePeople.length - ranked.people.length);

  if (onlineIds != null && ranked.people.length === 0) return null;

  return (
    <nav aria-label={label} className="mt-1 min-w-0 max-w-full">
      <p className="text-1 tracking-[0.12em] text-neutral-11 uppercase">
        {label}
      </p>
      {onlineIds == null ? (
        <div className="mt-3 flex gap-3" aria-hidden>
          {Array.from({ length: VISIBLE_PEOPLE }, (_, index) => (
            <span
              key={index}
              className="h-16 w-16 animate-pulse rounded-full bg-neutral-3"
            />
          ))}
        </div>
      ) : (
        <ul className="mt-3 flex max-w-full flex-wrap items-center gap-3">
          {ranked.people.map((person, index) => {
            const name = personLabel(person, fallbackName);
            const href = person.slug ? `/${lang}/profile/${person.slug}` : null;
            const hover =
              ranked.basis === 'sharedSpaces'
                ? `${name}. ${t('sharedSpaces', {
                    count: person.sharedSpaceCount,
                  })}`
                : name;
            const opening = openingId === person.id;
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
                    size="lg"
                    shape="circle"
                    className="!h-16 !w-16"
                  />
                </span>
                <span
                  aria-hidden
                  className="absolute bottom-0 left-1/2 h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-success-9 ring-2 ring-background"
                />
              </span>
            );

            return (
              <li
                key={person.id}
                className="flex shrink-0 flex-col items-center gap-1"
              >
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
                {isPersonRole(person.primaryOrientation) ? (
                  <PersonRoleBadge role={person.primaryOrientation} />
                ) : null}
              </li>
            );
          })}
          {rest > 0 ? (
            <li>
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-neutral-7 text-2 text-neutral-12">
                {t('sensingMore', { count: rest })}
              </span>
            </li>
          ) : null}
        </ul>
      )}
    </nav>
  );
}
