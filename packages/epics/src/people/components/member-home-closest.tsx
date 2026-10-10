'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ClientEvent, EventType, type MatrixClient } from 'matrix-js-sdk';
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

type ClosestPerson = MemberIntelligence['connections'][number];

const VISIBLE_PEOPLE = 12;

type MemberHomeClosestProps = {
  lang: Locale;
  people: ClosestPerson[];
  /** Everyone around the member, including people not drawn as icons. */
  peopleCount: number;
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

export function MemberHomeClosest({
  lang,
  people,
  peopleCount,
  fallbackName,
  onOpenChat,
}: MemberHomeClosestProps) {
  const t = useTranslations('MemberHome');
  const router = useRouter();
  const matrix = useMatrix();
  const [messageCounts, setMessageCounts] = useState<Map<number, number>>(
    () => new Map(),
  );
  const [openingId, setOpeningId] = useState<number | null>(null);
  const openingRef = useRef(false);
  const personIds = useMemo(() => people.map((person) => person.id), [people]);
  const { personIdToMatrixUserId } = useMatrixUserIdsByPersonIds({
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

  const ranked = useMemo(
    () => rankClosestContributors(people, messageCounts, VISIBLE_PEOPLE),
    [messageCounts, people],
  );

  if (ranked.people.length === 0) return null;

  const label =
    ranked.basis === 'messages' ? t('closestTalk') : t('closestInSpaces');

  const rest = Math.max(0, peopleCount - ranked.people.length);

  return (
    <nav
      aria-label={label}
      className="flex min-w-0 max-w-full flex-col items-end gap-2"
    >
      <p className="text-right text-1 font-medium tracking-[0.08em] text-foreground uppercase">
        {label}
      </p>
      <ul className="flex max-w-full flex-wrap items-center justify-end gap-2">
        {ranked.people.map((person) => {
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
            <PersonAvatar
              avatarSrc={person.avatarUrl ?? undefined}
              userName={name}
              size="chat"
              shape="circle"
              className="h-12 w-12"
            />
          );

          return (
            <li key={person.id} className="shrink-0">
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
          <li className="text-2 font-medium whitespace-nowrap text-foreground">
            {t('morePeople', { count: rest })}
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
