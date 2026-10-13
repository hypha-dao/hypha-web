'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import {
  ClientEvent,
  EventType,
  NotificationCountType,
  RoomEvent,
  SyncState,
  type MatrixClient,
  type Room,
} from 'matrix-js-sdk';
import {
  useJwt,
  useMatrix,
  useMatrixUserIdsByPersonIds,
  type MemberIntelligence,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';

import { useHumanChatPanel } from '../../common/human-chat-panel-context';
import {
  MemberHomePeople,
  type MemberHomeOpenChat,
} from './member-home-people';
import { PersonAvatar } from './person-avatar';

const STALE_MS = 14 * 24 * 60 * 60 * 1000;
const REACH_OUT_LIMIT = 6;

type ConnectionPerson = MemberIntelligence['connections'][number];

type ConversationRow = {
  roomId: string;
  name: string;
  avatarUrl?: string;
  preview: string;
  mine: boolean;
  lastTs: number | null;
  unread: number;
  memberCount: number;
  otherUserId: string | null;
  kind: 'person' | 'group';
};

type ReachOutCard = {
  key: string;
  name: string;
  avatarUrl?: string;
  roomId: string | null;
  lastTs: number | null;
  person: ConnectionPerson | null;
};

function botUserId() {
  return process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID?.trim() || null;
}

function looksLikeHyphaBot(value: string | null | undefined) {
  return Boolean(value && /hypha[_-]bot/i.test(value));
}

function isHyphaBot(userId: string | undefined, name?: string | null) {
  const configured = botUserId();
  if (configured && userId === configured) return true;
  const local = userId?.replace(/^@/, '').split(':')[0] ?? '';
  return looksLikeHyphaBot(local) || looksLikeHyphaBot(name);
}

function personName(person: ConnectionPerson, fallback: string) {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname || fallback;
}

function messagePreview(body: string) {
  const kept = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('>'));
  const text = (kept.at(-1) ?? body)
    .replace(/<?@[A-Za-z0-9._=\-/]+:[A-Za-z0-9.-]+(?::\d+)?>?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= 80) return text;
  return `${text.slice(0, 79)}…`;
}

function avatarHttp(client: MatrixClient, mxc: string | null | undefined) {
  if (!mxc) return undefined;
  return client.mxcUrlToHttp(mxc, 80, 80, 'crop') ?? undefined;
}

function lastRoomMessage(room: Room, selfId: string | null) {
  const events = room.getLiveTimeline().getEvents();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event || event.getType() !== EventType.RoomMessage) continue;
    if (event.isRedacted()) continue;
    const body = String(event.getContent()?.body ?? '');
    const sender = event.getSender();
    return {
      preview: messagePreview(body),
      mine: Boolean(selfId && sender === selfId),
      ts: event.getTs(),
    };
  }
  const ts = room.getLastActiveTimestamp();
  return {
    preview: '',
    mine: false,
    ts: ts > 0 ? ts : null,
  };
}

export function readConversationRows(client: MatrixClient): ConversationRow[] {
  const botId = botUserId();
  const selfId = client.getUserId();
  const rows: ConversationRow[] = [];

  for (const room of client.getRooms()) {
    if (room.getMyMembership() !== 'join') continue;
    const members = room.getJoinedMembers().filter((member) => {
      if (!member.userId) return false;
      if (member.userId === botId) return false;
      return !isHyphaBot(member.userId, member.name || member.rawDisplayName);
    });
    const others = members.filter((member) => member.userId !== selfId);
    if (others.length === 0) continue;

    const kind = others.length === 1 ? 'person' : 'group';
    const other = others.length === 1 ? others[0] : undefined;
    const name =
      (kind === 'person' ? other?.name || other?.rawDisplayName : room.name) ||
      room.name ||
      '';
    if (
      isHyphaBot(other?.userId, name) ||
      looksLikeHyphaBot(room.name) ||
      looksLikeHyphaBot(name)
    ) {
      continue;
    }
    const mxc =
      kind === 'person'
        ? other?.getMxcAvatarUrl() || room.getMxcAvatarUrl()
        : room.getMxcAvatarUrl();
    const last = lastRoomMessage(room, selfId);
    const unread = room.getUnreadNotificationCount(NotificationCountType.Total);

    rows.push({
      roomId: room.roomId,
      name: name.trim(),
      avatarUrl: avatarHttp(client, mxc),
      preview: last.preview,
      mine: last.mine,
      lastTs: last.ts,
      unread: typeof unread === 'number' && unread > 0 ? unread : 0,
      memberCount: members.length,
      otherUserId: other?.userId ?? null,
      kind,
    });
  }

  rows.sort((left, right) => (right.lastTs ?? 0) - (left.lastTs ?? 0));
  return rows;
}

export function sumConversationUnread(client: MatrixClient | null) {
  if (!client) return 0;
  let total = 0;
  for (const room of client.getRooms()) {
    if (room.getMyMembership() !== 'join') continue;
    const count = room.getUnreadNotificationCount(NotificationCountType.Total);
    if (typeof count === 'number' && count > 0) total += count;
  }
  return total;
}

export function useConversationUnreadCount() {
  const { client } = useMatrix();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!client) {
      setCount(0);
      return;
    }
    const refresh = () => {
      const next = sumConversationUnread(client);
      setCount((prev) => (prev === next ? prev : next));
    };
    refresh();
    client.on(ClientEvent.Sync, refresh);
    client.on(RoomEvent.Timeline, refresh);
    client.on(RoomEvent.Receipt, refresh);
    return () => {
      client.removeListener(ClientEvent.Sync, refresh);
      client.removeListener(RoomEvent.Timeline, refresh);
      client.removeListener(RoomEvent.Receipt, refresh);
    };
  }, [client]);

  return count;
}

function formatWhen(ts: number, locale: string, justNow: string) {
  const minutes = Math.round((Date.now() - ts) / 60000);
  if (minutes < 1) return justNow;
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (minutes < 60) return relative.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return relative.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 7) return relative.format(-days, 'day');
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(ts);
}

export function MyConnections() {
  const t = useTranslations('Connections');
  const tChat = useTranslations('MemberHome');
  const locale = useLocale();
  const { jwt } = useJwt();
  const { client, isMatrixAvailable } = useMatrix();
  const { openCoherenceChat } = useHumanChatPanel();
  const openChatRef = useRef<MemberHomeOpenChat | null>(null);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [synced, setSynced] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: home } = useSWR<MemberIntelligence | null>(
    jwt ? ['/api/v1/people/me/intelligence', jwt] : null,
    async ([url, token]) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      return (await response.json()) as MemberIntelligence;
    },
  );

  const connections = home?.connections ?? [];
  const { personIdToMatrixUserId } = useMatrixUserIdsByPersonIds({
    personIds: connections.map((person) => person.id),
  });

  useEffect(() => {
    if (!client) {
      setRows([]);
      setSynced(false);
      return;
    }
    const refresh = () => {
      setRows(readConversationRows(client));
      const state = client.getSyncState();
      if (state === SyncState.Prepared || state === SyncState.Syncing) {
        setSynced(true);
      }
    };
    refresh();
    const onSync = () => {
      refresh();
      setSynced(true);
    };
    client.on(ClientEvent.Sync, onSync);
    client.on(RoomEvent.Timeline, refresh);
    client.on(RoomEvent.Receipt, refresh);
    client.on(RoomEvent.MyMembership, refresh);
    return () => {
      client.removeListener(ClientEvent.Sync, onSync);
      client.removeListener(RoomEvent.Timeline, refresh);
      client.removeListener(RoomEvent.Receipt, refresh);
      client.removeListener(RoomEvent.MyMembership, refresh);
    };
  }, [client]);

  const personByMatrixId = useMemo(() => {
    const map = new Map<string, ConnectionPerson>();
    for (const person of connections) {
      const mxid = personIdToMatrixUserId[person.id];
      if (mxid) map.set(mxid, person);
    }
    return map;
  }, [connections, personIdToMatrixUserId]);

  const reachOut = useMemo(() => {
    if (!synced) return [];
    const now = Date.now();
    const people = rows.filter((row) => row.kind === 'person');
    const recent = new Set(
      people
        .filter((row) => row.lastTs != null && now - row.lastTs <= STALE_MS)
        .map((row) => row.otherUserId)
        .filter((id): id is string => Boolean(id)),
    );
    const seenPeople = new Set<string>();
    const cards: ReachOutCard[] = people
      .filter((row) => row.lastTs == null || now - row.lastTs > STALE_MS)
      .filter((row) => !isHyphaBot(row.otherUserId ?? undefined, row.name))
      .filter((row) => {
        const id = row.otherUserId ?? row.roomId;
        if (seenPeople.has(id)) return false;
        seenPeople.add(id);
        return true;
      })
      .map((row) => {
        const person = row.otherUserId
          ? personByMatrixId.get(row.otherUserId)
          : undefined;
        return {
          key: row.roomId,
          name: person
            ? personName(person, t('someone'))
            : row.name || t('someone'),
          avatarUrl: person?.avatarUrl || row.avatarUrl,
          roomId: row.roomId,
          lastTs: row.lastTs,
          person: person ?? null,
        };
      });
    const covered = new Set(
      people
        .map((row) => row.otherUserId)
        .filter((id): id is string => Boolean(id)),
    );

    for (const person of connections) {
      if (cards.length >= REACH_OUT_LIMIT) break;
      const mxid = personIdToMatrixUserId[person.id];
      const name = personName(person, t('someone'));
      if (isHyphaBot(mxid, name)) continue;
      if (mxid && (recent.has(mxid) || covered.has(mxid))) continue;
      cards.push({
        key: `person-${person.id}`,
        name,
        avatarUrl: person.avatarUrl ?? undefined,
        roomId: null,
        lastTs: null,
        person,
      });
    }

    return cards
      .sort((left, right) => {
        if (left.lastTs == null && right.lastTs == null) return 0;
        if (left.lastTs == null) return 1;
        if (right.lastTs == null) return -1;
        return left.lastTs - right.lastTs;
      })
      .slice(0, REACH_OUT_LIMIT);
  }, [connections, personByMatrixId, personIdToMatrixUserId, rows, synced, t]);

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? rows.filter((row) => {
        const haystack = `${row.name} ${row.preview}`.toLowerCase();
        return haystack.includes(needle);
      })
    : rows;
  const people = visible
    .filter(
      (row) =>
        row.kind === 'person' &&
        !isHyphaBot(row.otherUserId ?? undefined, row.name),
    )
    .map((row) => {
      const person = row.otherUserId
        ? personByMatrixId.get(row.otherUserId)
        : undefined;
      if (!person) return row;
      return {
        ...row,
        name: personName(person, row.name || t('someone')),
        avatarUrl: person.avatarUrl || row.avatarUrl,
      };
    });
  const groups = visible.filter(
    (row) => row.kind === 'group' && !looksLikeHyphaBot(row.name),
  );

  function openRow(row: ConversationRow) {
    setNotice(null);
    openCoherenceChat(
      row.roomId,
      row.name || t('someone'),
      '',
      null,
      home?.chatSpaceSlug ?? null,
    );
  }

  async function openReachOut(card: ReachOutCard) {
    setNotice(null);
    if (card.roomId) {
      openCoherenceChat(
        card.roomId,
        card.name,
        '',
        null,
        home?.chatSpaceSlug ?? null,
      );
      return;
    }
    if (!card.person) return;
    const opened = await openChatRef.current?.({
      id: card.person.id,
      slug: card.person.slug,
      name: card.person.name,
      surname: card.person.surname,
      nickname: card.person.nickname,
      avatarUrl: card.person.avatarUrl,
    });
    if (!opened) setNotice(tChat('matrixUnavailable'));
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <MemberHomePeople
        people={connections}
        chatSpaceSlug={home?.chatSpaceSlug ?? null}
        fallbackName={t('someone')}
        onOpenChatReady={(openChat) => {
          openChatRef.current = openChat;
        }}
      />

      {reachOut.length > 0 ? (
        <section className="flex flex-col gap-3" aria-label={t('reachOut')}>
          <div className="flex flex-col gap-1">
            <h2
              className="text-4 text-foreground"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {t('reachOut')}
            </h2>
            <p className="text-2 text-muted-foreground">
              {t('longTimeSentence')}
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {reachOut.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => void openReachOut(card)}
                className="flex w-40 shrink-0 flex-col items-start gap-2 border border-border p-3 text-left hover:bg-accent-2"
              >
                <PersonAvatar
                  size="chat"
                  shape="circle"
                  avatarSrc={card.avatarUrl}
                  userName={card.name}
                />
                <span className="w-full truncate text-2 text-foreground">
                  {card.name}
                </span>
                <span className="text-1 text-foreground">
                  {t('longTimeNoSee')}
                </span>
                <span className="text-1 text-muted-foreground">
                  {card.lastTs
                    ? formatWhen(card.lastTs, locale, t('justNow'))
                    : t('noMessage')}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="sr-only">{t('search')}</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('search')}
          className="h-10 w-full border border-border bg-transparent px-3 text-2 text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>

      {notice ? (
        <p className="text-1 text-error-11" role="alert">
          {notice}
        </p>
      ) : null}

      {!isMatrixAvailable ? (
        <p className="text-2 text-muted-foreground">
          {tChat('matrixUnavailable')}
        </p>
      ) : null}

      {isMatrixAvailable &&
      synced &&
      people.length === 0 &&
      groups.length === 0 ? (
        <p className="text-2 text-muted-foreground">
          {needle ? t('noMatches') : t('empty')}
        </p>
      ) : null}

      {people.length > 0 || groups.length > 0 ? (
        <div className="border border-border">
          <ConversationSection
            title={t('people')}
            rows={people}
            locale={locale}
            justNow={t('justNow')}
            noMessage={t('noMessage')}
            youLabel={(message) => t('youWrote', { message })}
            unreadLabel={(count) => t('unread', { count })}
            membersLabel={() => ''}
            onOpen={openRow}
          />
          <ConversationSection
            title={t('groups')}
            rows={groups}
            locale={locale}
            justNow={t('justNow')}
            noMessage={t('noMessage')}
            youLabel={(message) => t('youWrote', { message })}
            unreadLabel={(count) => t('unread', { count })}
            membersLabel={(count) => t('members', { count })}
            onOpen={openRow}
          />
        </div>
      ) : null}
    </div>
  );
}

function ConversationSection({
  title,
  rows,
  locale,
  justNow,
  noMessage,
  youLabel,
  unreadLabel,
  membersLabel,
  onOpen,
}: {
  title: string;
  rows: ConversationRow[];
  locale: string;
  justNow: string;
  noMessage: string;
  youLabel: (message: string) => string;
  unreadLabel: (count: number) => string;
  membersLabel: (count: number) => string;
  onOpen: (row: ConversationRow) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h2
        className="border-b border-border px-3 py-2 text-2 text-foreground"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {title}
      </h2>
      <ul>
        {rows.map((row) => {
          const preview = row.preview
            ? row.mine
              ? youLabel(row.preview)
              : row.preview
            : noMessage;
          const when = row.lastTs
            ? formatWhen(row.lastTs, locale, justNow)
            : '';
          const members =
            row.kind === 'group' ? membersLabel(row.memberCount) : '';
          return (
            <li
              key={row.roomId}
              className="border-b border-border last:border-b-0"
            >
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-accent-2"
              >
                <PersonAvatar
                  size="chat"
                  shape={row.kind === 'group' ? 'square' : 'circle'}
                  avatarSrc={row.avatarUrl}
                  userName={row.name}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span
                      className={cn(
                        'truncate text-2 text-foreground',
                        row.unread > 0 && 'font-semibold',
                      )}
                    >
                      {row.name}
                    </span>
                    {when ? (
                      <span className="shrink-0 text-1 text-muted-foreground">
                        {when}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-3">
                    <span className="truncate text-1 text-muted-foreground">
                      {members ? `${members} · ${preview}` : preview}
                    </span>
                    {row.unread > 0 ? (
                      <span
                        className="grid h-5 min-w-5 shrink-0 place-items-center bg-foreground px-1 text-[10px] leading-none text-background"
                        aria-label={unreadLabel(row.unread)}
                      >
                        {row.unread > 99 ? '99+' : row.unread}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
