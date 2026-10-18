'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import {
  ClientEvent,
  EventType,
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
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { Phone, Search, X } from 'lucide-react';

import { useGlobalCallDock } from '../../common/global-call-dock-context';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';
import {
  MemberHomePeople,
  type MemberHomeOpenChat,
} from './member-home-people';
import {
  isHyphaBot,
  looksLikeHyphaBot,
  memberRowsForConnections,
  unreadRoomsMissingFromMembers,
  STALE_CONNECTION_MS,
  suggestConnections,
  type ConnectionSuggestion,
  type ConversationRow,
  type MemberRow,
  type NewcomerCandidate,
} from './member-connections';
import {
  sortByRecencyThenPresence,
  type PresenceLevel,
} from './member-presence';
import { PersonAvatar } from './person-avatar';
import { PresenceDot } from './presence-dot';
import { useMemberPresence } from './use-member-presence';

/** Matches the first page returned for the home. Each click asks for one more. */
const CONNECTIONS_PAGE = 12;

type ConnectionPerson = MemberIntelligence['connections'][number];
type ConnectionMemberRow = MemberRow<ConnectionPerson>;

function botUserId() {
  return process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID?.trim() || null;
}

function messagePreview(body: string) {
  const kept = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('>'));
  const text = (kept.at(-1) ?? body)
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, (url) => {
      try {
        return new URL(url.replace(/[),.;]+$/, '')).hostname.replace(
          /^www\./,
          '',
        );
      } catch {
        return 'link';
      }
    })
    .replace(/<?@[A-Za-z0-9._=\-/]+:[A-Za-z0-9.-]+(?::\d+)?>?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= 48) return text;
  return `${text.slice(0, 47).trimEnd()}…`;
}

function avatarHttp(client: MatrixClient, mxc: string | null | undefined) {
  if (!mxc) return undefined;
  return client.mxcUrlToHttp(mxc, 80, 80, 'crop') ?? undefined;
}

/** Messages from the other person that this member has not read yet. */
function countNewMessages(room: Room, selfId: string | null) {
  if (!selfId) return 0;
  const readUpToId = room.getEventReadUpTo(selfId, false);
  let count = 0;
  for (const event of room.getLiveTimeline().getEvents()) {
    if (event.getType() !== EventType.RoomMessage) continue;
    if (event.isRedacted()) continue;
    const relates = event.getContent()?.['m.relates_to'] as
      | { rel_type?: string }
      | undefined;
    if (relates?.rel_type === 'm.replace') continue;
    const sender = event.getSender();
    const id = event.getId();
    if (!sender || !id || sender === selfId) continue;
    if (readUpToId) {
      const order = room.compareEventOrdering(readUpToId, id);
      if (order !== null && order >= 0) continue;
    }
    if (
      typeof room.hasUserReadEvent === 'function' &&
      room.hasUserReadEvent(selfId, id)
    ) {
      continue;
    }
    count += 1;
  }
  return count;
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

    rows.push({
      roomId: room.roomId,
      name: name.trim(),
      avatarUrl: avatarHttp(client, mxc),
      preview: last.preview,
      mine: last.mine,
      lastTs: last.ts,
      unread: kind === 'person' ? countNewMessages(room, selfId) : 0,
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
  return readConversationRows(client).reduce(
    (total, row) => total + row.unread,
    0,
  );
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
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const { jwt } = useJwt();
  const { client, isMatrixAvailable, createRoom } = useMatrix();
  const { startAudioForRoom } = useGlobalCallDock();
  const { openCoherenceChat } = useHumanChatPanel();
  const openChatRef = useRef<MemberHomeOpenChat | null>(null);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [synced, setSynced] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [picking, setPicking] = useState(false);
  const [calling, setCalling] = useState(false);
  const [directory, setDirectory] = useState<ConnectionPerson[] | null>(null);
  const [searchDirectory, setSearchDirectory] = useState<
    ConnectionPerson[] | null
  >(null);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [directoryComplete, setDirectoryComplete] = useState(false);

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

  const connections =
    directory && directory.length >= (home?.connections.length ?? 0)
      ? directory
      : home?.connections ?? [];
  const connectionTotal = Math.max(
    home?.counts.connections ?? 0,
    connections.length,
  );
  const hasMorePeople =
    !directoryComplete && connections.length < connectionTotal;
  const needle = query.trim().toLowerCase();
  const listed =
    needle && searchDirectory != null ? searchDirectory : connections;
  const { personIdToMatrixUserId } = useMatrixUserIdsByPersonIds({
    personIds: listed.map((person) => person.id),
  });

  useEffect(() => {
    const term = query.trim();
    if (!term || !jwt) {
      setSearchDirectory(null);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void (async () => {
        try {
          const response = await fetch(
            `/api/v1/people/me/intelligence?q=${encodeURIComponent(term)}`,
            {
              headers: { Authorization: `Bearer ${jwt}` },
              signal: controller.signal,
            },
          );
          if (!response.ok) return;
          const body = (await response.json()) as MemberIntelligence;
          if (!controller.signal.aborted) {
            setSearchDirectory(body.connections ?? []);
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }
        } finally {
          if (!controller.signal.aborted) setSearching(false);
        }
      })();
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [jwt, query]);

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

  const members = useMemo(() => {
    const directoryRows = memberRowsForConnections(
      listed,
      rows,
      personIdToMatrixUserId,
      home?.person.id ?? null,
      t('someone'),
    );
    return [
      ...unreadRoomsMissingFromMembers(
        rows,
        directoryRows,
        personIdToMatrixUserId,
      ),
      ...directoryRows,
    ];
  }, [home?.person.id, listed, personIdToMatrixUserId, rows, t]);

  const memberPersonIds = useMemo(
    () => members.map((row) => row.person.id),
    [members],
  );
  const { presenceById } = useMemberPresence(memberPersonIds);

  const reachOut = useMemo(() => {
    if (!synced) return [];
    const newcomers: NewcomerCandidate[] = [];
    const seen = new Set<number>();
    for (const signal of home?.networkSignals ?? []) {
      const id = signal.creatorId;
      const name = signal.creatorName?.trim();
      if (id == null || !name || seen.has(id)) continue;
      seen.add(id);
      newcomers.push({
        id,
        name,
        avatarUrl: signal.creatorAvatarUrl,
        spaceTitle: signal.spaceTitle,
        spaceSlug: signal.spaceSlug,
        score: signal.relevance?.score ?? 0,
      });
    }
    return suggestConnections(
      members,
      newcomers,
      Date.now(),
      STALE_CONNECTION_MS,
    );
  }, [home?.networkSignals, members, synced]);
  const reachOutIds = useMemo(
    () => reachOut.map((card) => card.person.id),
    [reachOut],
  );

  const people = useMemo(() => {
    const filtered = needle
      ? members.filter((row) => {
          const haystack = [row.name, row.person.nickname, row.person.slug]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(needle);
        })
      : members;
    return sortByRecencyThenPresence(filtered, presenceById);
  }, [members, needle, presenceById]);
  const selectedPeople = members.filter((row) => selected.has(row.person.id));

  async function loadMorePeople() {
    if (loadingMore || !jwt || !hasMorePeople) return;
    setLoadingMore(true);
    setMoreFailed(false);
    const next = Math.min(
      connections.length + CONNECTIONS_PAGE,
      connectionTotal,
    );
    try {
      const response = await fetch(
        `/api/v1/people/me/intelligence?connections=${next}`,
        { headers: { Authorization: `Bearer ${jwt}` } },
      );
      if (!response.ok) {
        setMoreFailed(true);
        return;
      }
      const body = (await response.json()) as MemberIntelligence;
      const page = body.connections ?? [];
      if (page.length <= connections.length) {
        setDirectoryComplete(true);
        return;
      }
      setDirectory(page);
      if (page.length >= (body.counts?.connections ?? connectionTotal)) {
        setDirectoryComplete(true);
      }
    } catch {
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  function toggleSelected(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitPicking() {
    setPicking(false);
    setSelected(new Set());
  }

  async function openMember(row: ConnectionMemberRow) {
    if (picking) {
      toggleSelected(row.person.id);
      return;
    }
    setNotice(null);
    if (row.roomId) {
      openCoherenceChat(
        row.roomId,
        row.name,
        '',
        null,
        home?.chatSpaceSlug ?? null,
      );
      return;
    }
    const opened = await openChatRef.current?.({
      id: row.person.id,
      slug: row.person.slug,
      name: row.person.name,
      surname: row.person.surname,
      nickname: row.person.nickname,
      avatarUrl: row.person.avatarUrl,
    });
    if (!opened) setNotice(tChat('matrixUnavailable'));
  }

  async function startGroupCall() {
    if (selectedPeople.length < 2 || calling) return;
    setCalling(true);
    setNotice(null);
    const title = selectedPeople.map((row) => row.name).join(', ');
    try {
      const { roomId } = await createRoom(title);
      if (client) {
        for (const row of selectedPeople) {
          const mxid = personIdToMatrixUserId[row.person.id];
          if (!mxid) continue;
          await client.invite(roomId, mxid).catch(() => undefined);
        }
      }
      openCoherenceChat(roomId, title, '', null, null);
      await startAudioForRoom(roomId, null, undefined, jwt, {
        roomTitle: title,
      });
      exitPicking();
    } catch {
      setNotice(tChat('callFailed'));
    } finally {
      setCalling(false);
    }
  }

  async function openReachOut(card: ConnectionSuggestion) {
    setNotice(null);
    if (card.roomId) {
      openCoherenceChat(card.roomId, card.name, '', null, null);
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
        extraPersonIds={reachOutIds}
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
              {t('suggestSentence')}
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {reachOut.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => void openReachOut(card)}
                className="flex w-40 shrink-0 flex-col items-start gap-2 rounded-2xl border border-border p-3 text-left hover:bg-accent-2"
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
                  {card.kind === 'reconnect'
                    ? t('longTimeNoSee')
                    : t('worthMeeting')}
                </span>
                <span className="w-full truncate text-1 text-muted-foreground">
                  {card.kind === 'reconnect'
                    ? card.lastTs
                      ? formatWhen(card.lastTs, locale, t('justNow'))
                      : t('noMessage')
                    : card.spaceTitle
                    ? card.spaceTitle
                    : card.sharedSpaceCount > 0
                    ? t('sharedCount', { count: card.sharedSpaceCount })
                    : t('noMessage')}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{t('search')}</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-9"
              strokeWidth={1.5}
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('search')}
              className="h-10 w-full rounded-full border border-border bg-background pr-3 pl-10 text-2 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
            />
          </label>
          {picking ? (
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              className="shrink-0"
              onClick={exitPicking}
            >
              {t('cancelPick')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              className="shrink-0 gap-1.5"
              disabled={!isMatrixAvailable || people.length < 2}
              onClick={() => setPicking(true)}
            >
              <Phone className="size-3.5" strokeWidth={1.5} aria-hidden />
              {t('groupCall')}
            </Button>
          )}
        </div>

        {picking && selectedPeople.length > 0 ? (
          <div
            className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label={t('selectedCount', { count: selectedPeople.length })}
          >
            {selectedPeople.map((row) => (
              <button
                key={row.person.id}
                type="button"
                className="flex w-16 shrink-0 flex-col items-center gap-1 text-center"
                aria-label={t('removeSelected', { name: row.name })}
                onClick={() => toggleSelected(row.person.id)}
              >
                <span className="relative inline-flex">
                  <PersonAvatar
                    size="chat"
                    shape="circle"
                    avatarSrc={row.avatarUrl}
                    userName={row.name}
                  />
                  <span
                    className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-foreground text-background"
                    aria-hidden
                  >
                    <X className="size-2.5" strokeWidth={2.5} />
                  </span>
                </span>
                <span className="w-full truncate text-1 text-neutral-11">
                  {row.name.split(' ')[0] || row.name}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {picking ? (
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-1 text-neutral-11">
              {selectedPeople.length > 0
                ? t('selectedCount', { count: selectedPeople.length })
                : t('pickMembers')}
            </p>
            <Button
              type="button"
              disabled={selectedPeople.length < 2 || calling}
              className="shrink-0 gap-1.5"
              onClick={() => void startGroupCall()}
            >
              <Phone className="size-3.5" strokeWidth={1.5} aria-hidden />
              {t('startGroupCall')}
            </Button>
          </div>
        ) : null}
      </div>

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

      {home != null && people.length === 0 && !searching ? (
        <p className="text-2 text-muted-foreground">
          {needle ? t('noMatches') : t('empty')}
        </p>
      ) : null}

      {people.length > 0 ? (
        <MemberList
          title={t('people')}
          rows={people}
          presenceById={presenceById}
          locale={locale}
          justNow={t('justNow')}
          noMessage={t('noMessage')}
          youLabel={(message) => t('youWrote', { message })}
          unreadLabel={(count) => t('unread', { count })}
          selectLabel={(name) => t('selectMember', { name })}
          picking={picking}
          selected={selected}
          onOpen={(row) => void openMember(row)}
        />
      ) : null}

      {hasMorePeople && !needle ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            disabled={loadingMore}
            onClick={() => void loadMorePeople()}
          >
            {tCommon('loadMore')}
          </Button>
        </div>
      ) : null}

      {moreFailed ? (
        <p className="text-center text-1 text-error-11" role="alert">
          {t('loadMoreFailed')}
        </p>
      ) : null}
    </div>
  );
}

function MemberList({
  title,
  rows,
  presenceById,
  locale,
  justNow,
  noMessage,
  youLabel,
  unreadLabel,
  selectLabel,
  picking,
  selected,
  onOpen,
}: {
  title: string;
  rows: ConnectionMemberRow[];
  presenceById: ReadonlyMap<number, PresenceLevel>;
  locale: string;
  justNow: string;
  noMessage: string;
  youLabel: (message: string) => string;
  unreadLabel: (count: number) => string;
  selectLabel: (name: string) => string;
  picking: boolean;
  selected: Set<number>;
  onOpen: (row: ConnectionMemberRow) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-background">
      <h2 className="border-b border-border px-4 py-3 text-1 tracking-[0.12em] text-neutral-11 uppercase">
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
          const checked = selected.has(row.person.id);
          const presence = presenceById.get(row.person.id) ?? 'offline';
          return (
            <li
              key={row.person.id}
              className="border-b border-border last:border-b-0"
            >
              <button
                type="button"
                onClick={() => onOpen(row)}
                aria-pressed={picking ? checked : undefined}
                aria-label={picking ? selectLabel(row.name) : undefined}
                className={cn(
                  'flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left hover:bg-accent-2',
                  picking && checked && 'bg-accent-2/60',
                )}
              >
                {picking ? (
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-5 shrink-0 place-items-center rounded-full border border-neutral-8',
                      checked && 'border-foreground bg-foreground',
                    )}
                  >
                    {checked ? (
                      <span className="size-2 rounded-full bg-background" />
                    ) : null}
                  </span>
                ) : null}
                <span className="relative inline-flex shrink-0">
                  <PersonAvatar
                    size="chat"
                    shape="circle"
                    avatarSrc={row.avatarUrl}
                    userName={row.name}
                  />
                  <PresenceDot level={presence} />
                </span>
                <span className="min-w-0 flex-1 pr-2">
                  <span className="flex items-baseline justify-between gap-3">
                    <span
                      className={cn(
                        'min-w-0 truncate text-2 text-foreground',
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
                    <span className="min-w-0 flex-1 truncate text-1 text-muted-foreground">
                      {preview}
                    </span>
                    {row.unread > 0 ? (
                      <span
                        className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-foreground px-1.5 text-[10px] leading-none text-background"
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
