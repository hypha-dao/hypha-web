'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import {
  ClientEvent,
  EventType,
  MatrixEventEvent,
  RoomEvent,
  SyncState,
  type MatrixClient,
  type MatrixEvent,
  type Room,
} from 'matrix-js-sdk';
import {
  looksLikeTechnicalMatrixDisplayName,
  matrixMemberDisplayLabel,
  useJwt,
  useMatrix,
  useMatrixUserIdsByPersonIds,
  type MemberIntelligence,
} from '@hypha-platform/core/client';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { Search, Users, X } from 'lucide-react';

import { countIncomingUnreadMessages } from '../../common/human-chat-panel/conversation-unread-count';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';
import {
  CONVERSATION_UNREAD_EVENT,
  notifyConversationUnreadChanged,
} from './conversation-unread-event';
import {
  MemberHomePeople,
  type MemberHomeOpenChat,
} from './member-home-people';
import {
  eventContentIsSignalThread,
  isHyphaBot,
  isRememberedSignalThreadRoom,
  looksLikeHyphaBot,
  facesWithProfiles,
  groupRowsForConnections,
  isRememberedGroupChatRoom,
  memberRowsForConnections,
  messagePreview,
  previewWithNames,
  rememberGroupChatRooms,
  rememberSignalThreadRooms,
  subscribeSignalThreadRooms,
  unreadRoomsMissingFromMembers,
  STALE_CONNECTION_MS,
  connectionActivityTs,
  suggestConnections,
  type ConnectionSuggestion,
  type ConversationRow,
  type GroupFace,
  type MemberRow,
  type NewcomerCandidate,
} from './member-connections';
import {
  sortByRecencyThenPresence,
  type PresenceLevel,
} from './member-presence';
import { PersonAvatar } from './person-avatar';
import { useMemberPresence } from './use-member-presence';

/** Matches the first page returned for the home. Each click asks for one more. */
const CONNECTIONS_PAGE = 12;
/** Suggestions look past the first page, up to the intelligence cap. */
const SUGGESTION_POOL = 120;

type ConnectionPerson = MemberIntelligence['connections'][number];
type ConnectionMemberRow = MemberRow<ConnectionPerson>;

function botUserId() {
  return process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID?.trim() || null;
}

/** Sidebar snippets only need the recent window, the way a DM list does. */
const PREVIEW_TAIL = 24;
/** People on screen are built before the browser paints. */
const SYNC_ROOM_BUDGET = 16;
/** Everyone else fills while the browser is idle. */
const IDLE_ROOM_CHUNK = 8;

function eventsForPreview(room: Room): MatrixEvent[] {
  const live = room.getLiveTimeline().getEvents();
  const tail = live.length > PREVIEW_TAIL ? live.slice(-PREVIEW_TAIL) : live;
  let pending: MatrixEvent[] = [];
  try {
    if (typeof room.getPendingEvents === 'function') {
      pending = room.getPendingEvents();
    }
  } catch {
    pending = [];
  }
  if (pending.length === 0) return tail;
  const seen = new Set(
    tail
      .map((event) => event.getId())
      .filter((id): id is string => Boolean(id)),
  );
  return [
    ...tail,
    ...pending.filter((event) => {
      const id = event.getId();
      return !id || !seen.has(id);
    }),
  ];
}

function avatarHttp(client: MatrixClient, mxc: string | null | undefined) {
  if (!mxc) return undefined;
  return client.mxcUrlToHttp(mxc, 80, 80, 'crop') ?? undefined;
}

function lastRoomMessage(room: Room, selfId: string | null) {
  const events = eventsForPreview(room);
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event || event.isRedacted()) continue;
    // Encrypted events stay `m.room.encrypted` until decrypt. Skip them and
    // keep walking so an older clear message still previews.
    if (event.getType() !== EventType.RoomMessage) continue;
    const content = event.getContent() as { body?: unknown } | undefined;
    const body = typeof content?.body === 'string' ? content.body : '';
    const preview = messagePreview(body, (matrixUserId) => {
      const member = room.getMember(matrixUserId);
      if (!member) return '';
      return matrixMemberDisplayLabel(member, matrixUserId);
    });
    if (!preview) continue;
    const sender = event.getSender();
    return {
      preview,
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

function conversationRowFromRoom(
  client: MatrixClient,
  room: Room,
): ConversationRow | null {
  if (room.getMyMembership() !== 'join') return null;
  const botId = botUserId();
  const selfId = client.getUserId();
  const knownMembers = room
    .getMembers()
    .filter(
      (member) =>
        member.membership === 'join' || member.membership === 'invite',
    );
  const members = (
    knownMembers.length > 0 ? knownMembers : room.getJoinedMembers()
  ).filter((member) => {
    if (!member.userId) return false;
    if (member.userId === botId) return false;
    return !isHyphaBot(member.userId, member.name || member.rawDisplayName);
  });
  const others = members.filter((member) => member.userId !== selfId);
  if (others.length === 0) return null;

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
    return null;
  }
  const mxc =
    kind === 'person'
      ? other?.getMxcAvatarUrl() || room.getMxcAvatarUrl()
      : room.getMxcAvatarUrl();
  const faces =
    kind === 'group'
      ? others.slice(0, 2).map((member) => ({
          name:
            (member.name || member.rawDisplayName || '').trim() ||
            member.userId,
          userId: member.userId,
          avatarUrl: avatarHttp(
            client,
            member.getMxcAvatarUrl() ||
              client.getUser(member.userId)?.avatarUrl,
          ),
        }))
      : undefined;
  // The signal marker sits on a recent message. The older history is not
  // needed to decide whether this room belongs in the people list.
  const timeline = room.getLiveTimeline().getEvents();
  const tail =
    timeline.length > PREVIEW_TAIL ? timeline.slice(-PREVIEW_TAIL) : timeline;
  const signalMarkerInTimeline = tail.some(
    (event) =>
      event.getType() === EventType.RoomMessage &&
      eventContentIsSignalThread(
        event.getContent() as Record<string, unknown> | null,
      ),
  );
  const signalThread =
    isRememberedSignalThreadRoom(room.roomId) || signalMarkerInTimeline;
  if (signalThread) {
    rememberSignalThreadRooms([room.roomId], { quiet: true });
    return null;
  }
  const last = lastRoomMessage(room, selfId);
  // A long timeline means this room was already opened. The sync payload
  // already carries its unread total; walking every event blocks the list.
  const unread =
    timeline.length > 80 &&
    typeof room.getUnreadNotificationCount === 'function'
      ? room.getUnreadNotificationCount()
      : countIncomingUnreadMessages(room, selfId, isHyphaBot);

  return {
    roomId: room.roomId,
    name: name.trim(),
    avatarUrl: avatarHttp(client, mxc),
    preview: last.preview,
    mine: last.mine,
    lastTs: last.ts,
    unread,
    memberCount: members.length,
    otherUserId: other?.userId ?? null,
    faces,
    groupChat: kind === 'group' && isRememberedGroupChatRoom(room.roomId),
    kind,
  };
}

function sortConversationRows(rows: ConversationRow[]) {
  rows.sort((left, right) => (right.lastTs ?? 0) - (left.lastTs ?? 0));
  return rows;
}

function sameConversationRows(
  left: readonly ConversationRow[],
  right: readonly ConversationRow[],
) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const current = left[index];
    const next = right[index];
    if (!current || !next) return false;
    if (
      current.roomId !== next.roomId ||
      current.preview !== next.preview ||
      current.lastTs !== next.lastTs ||
      current.unread !== next.unread ||
      current.mine !== next.mine ||
      current.name !== next.name
    ) {
      return false;
    }
  }
  return true;
}

type CachedConversation = { stamp: string; row: ConversationRow | null };

/**
 * One summary per room, shared by the people list and the nav badge.
 * Discord and Element keep the sidebar on that summary: they do not walk
 * every channel's history, and a new message rewrites only that one row.
 * The people currently listed are summarised first; the rest wait for idle time.
 */
const conversationCache = new Map<string, CachedConversation>();
const conversationListeners = new Set<() => void>();
let conversationClient: MatrixClient | null = null;
let listeningClient: MatrixClient | null = null;
let conversationQueue: string[] = [];
let conversationPump: number | null = null;
let conversationPumpIdle = false;
let conversationNotifyQueued = false;
let releaseSignalRooms: (() => void) | null = null;

function roomStamp(room: Room, selfId: string | null) {
  const events = room.getLiveTimeline().getEvents();
  const last = events[events.length - 1];
  let clear = 0;
  const start = Math.max(0, events.length - PREVIEW_TAIL);
  for (let index = start; index < events.length; index += 1) {
    if (events[index]?.getType() === EventType.RoomMessage) clear += 1;
  }
  const receipt = selfId ? room.getEventReadUpTo(selfId, false) ?? '' : '';
  return [
    room.getMyMembership(),
    events.length,
    last?.getId() ?? '',
    last?.getTs() ?? 0,
    clear,
    receipt,
  ].join(':');
}

function cachedConversation(client: MatrixClient, room: Room) {
  const stamp = roomStamp(room, client.getUserId());
  const hit = conversationCache.get(room.roomId);
  if (hit?.stamp === stamp) return hit;
  const row = conversationRowFromRoom(client, room);
  const entry = { stamp, row };
  conversationCache.set(room.roomId, entry);
  return entry;
}

function conversationIsFresh(client: MatrixClient, room: Room) {
  const hit = conversationCache.get(room.roomId);
  if (!hit) return false;
  return hit.stamp === roomStamp(room, client.getUserId());
}

function priorityRoomIds(
  client: MatrixClient,
  matrixUserIds: readonly string[],
) {
  const wanted = new Set(matrixUserIds.map((id) => id.toLowerCase()));
  const found = new Map<string, string>();
  const direct = client.getAccountData(EventType.Direct)?.getContent() as
    | Record<string, string[] | undefined>
    | undefined;
  if (direct) {
    for (const matrixUserId of matrixUserIds) {
      const roomIds = direct[matrixUserId];
      if (!Array.isArray(roomIds)) continue;
      for (let index = roomIds.length - 1; index >= 0; index -= 1) {
        const room = client.getRoom(roomIds[index] ?? '');
        if (room?.getMyMembership() !== 'join') continue;
        found.set(matrixUserId.toLowerCase(), room.roomId);
        break;
      }
    }
  }
  if (found.size < wanted.size) {
    const selfId = client.getUserId();
    for (const room of client.getRooms()) {
      if (room.getMyMembership() !== 'join') continue;
      const joined =
        typeof room.getJoinedMemberCount === 'function'
          ? room.getJoinedMemberCount()
          : null;
      if (joined != null && joined > 2) continue;
      let members: { userId: string }[] = [];
      try {
        members = room.getJoinedMembers();
      } catch {
        continue;
      }
      const others = members.filter(
        (member) => member.userId && member.userId !== selfId,
      );
      if (others.length !== 1) continue;
      const key = others[0]?.userId.toLowerCase();
      if (!key || !wanted.has(key) || found.has(key)) continue;
      found.set(key, room.roomId);
    }
  }
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const matrixUserId of matrixUserIds) {
    const roomId = found.get(matrixUserId.toLowerCase());
    if (!roomId || seen.has(roomId)) continue;
    seen.add(roomId);
    ordered.push(roomId);
  }
  return ordered;
}

function cancelConversationPump() {
  if (conversationPump == null) return;
  if (conversationPumpIdle && typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(conversationPump);
  } else {
    window.clearTimeout(conversationPump);
  }
  conversationPump = null;
}

function notifyConversationListeners() {
  if (conversationNotifyQueued) return;
  conversationNotifyQueued = true;
  queueMicrotask(() => {
    conversationNotifyQueued = false;
    for (const listener of conversationListeners) listener();
  });
}

function enqueueConversationRooms(
  client: MatrixClient,
  front: readonly string[],
) {
  const needed: string[] = [];
  for (const roomId of front) {
    const room = client.getRoom(roomId);
    if (!room || conversationIsFresh(client, room)) continue;
    needed.push(roomId);
  }
  const neededSet = new Set(needed);
  const rest = conversationQueue.filter((roomId) => !neededSet.has(roomId));
  const queued = new Set<string>([...needed, ...rest]);
  const pending: { id: string; ts: number }[] = [];
  for (const room of client.getRooms()) {
    if (queued.has(room.roomId)) continue;
    if (conversationIsFresh(client, room)) continue;
    pending.push({
      id: room.roomId,
      ts:
        typeof room.getLastActiveTimestamp === 'function'
          ? room.getLastActiveTimestamp()
          : 0,
    });
  }
  pending.sort((left, right) => right.ts - left.ts);
  conversationQueue = [...needed, ...rest, ...pending.map((item) => item.id)];
}

function scheduleConversationPump() {
  if (conversationPump != null || conversationQueue.length === 0) return;
  if (typeof window === 'undefined') return;
  const run = () => {
    conversationPump = null;
    pumpConversationRooms(IDLE_ROOM_CHUNK);
  };
  if (typeof requestIdleCallback === 'function') {
    conversationPumpIdle = true;
    conversationPump = requestIdleCallback(run, { timeout: 400 });
  } else {
    conversationPumpIdle = false;
    conversationPump = window.setTimeout(run, 32);
  }
}

function pumpConversationRooms(limit: number) {
  const client = conversationClient;
  if (!client) return;
  let done = 0;
  while (limit > 0 && conversationQueue.length > 0 && done < limit) {
    const roomId = conversationQueue.shift();
    if (!roomId) break;
    const room = client.getRoom(roomId);
    if (!room || conversationIsFresh(client, room)) continue;
    cachedConversation(client, room);
    done += 1;
  }
  if (done > 0) notifyConversationListeners();
  scheduleConversationPump();
}

function refreshConversationRoom(room: Room | undefined) {
  const client = conversationClient;
  if (!client || !room) return;
  conversationQueue = conversationQueue.filter((id) => id !== room.roomId);
  conversationCache.delete(room.roomId);
  cachedConversation(client, room);
  notifyConversationListeners();
}

function onConversationSync() {
  const client = conversationClient;
  if (!client) return;
  enqueueConversationRooms(client, []);
  scheduleConversationPump();
  notifyConversationListeners();
}

function onConversationTimeline(
  _event: MatrixEvent,
  room?: Room,
  toStartOfTimeline?: boolean,
) {
  if (toStartOfTimeline) return;
  refreshConversationRoom(room);
}

function onConversationReceipt(_event: MatrixEvent, room?: Room) {
  refreshConversationRoom(room);
}

function onConversationMembership(room?: Room) {
  refreshConversationRoom(room);
}

function onConversationDecrypted(event: MatrixEvent) {
  const roomId = event.getRoomId();
  if (!roomId || !conversationClient) return;
  refreshConversationRoom(conversationClient.getRoom(roomId) ?? undefined);
}

function onConversationSignals() {
  const client = conversationClient;
  if (!client) return;
  for (const room of client.getRooms()) {
    if (!isRememberedSignalThreadRoom(room.roomId)) continue;
    conversationCache.delete(room.roomId);
    cachedConversation(client, room);
  }
  notifyConversationListeners();
}

function onConversationUnreadEvent() {
  const client = conversationClient;
  if (!client) return;
  enqueueConversationRooms(client, []);
  pumpConversationRooms(IDLE_ROOM_CHUNK);
}

function listenForConversationRows(client: MatrixClient) {
  if (listeningClient === client) return;
  if (listeningClient) stopListeningForConversationRows(listeningClient);
  listeningClient = client;
  client.on(ClientEvent.Sync, onConversationSync);
  client.on(RoomEvent.Timeline, onConversationTimeline);
  client.on(RoomEvent.Receipt, onConversationReceipt);
  client.on(RoomEvent.MyMembership, onConversationMembership);
  client.on(MatrixEventEvent.Decrypted, onConversationDecrypted);
  window.addEventListener(CONVERSATION_UNREAD_EVENT, onConversationUnreadEvent);
  releaseSignalRooms = subscribeSignalThreadRooms(onConversationSignals);
}

function stopListeningForConversationRows(client: MatrixClient) {
  client.removeListener(ClientEvent.Sync, onConversationSync);
  client.removeListener(RoomEvent.Timeline, onConversationTimeline);
  client.removeListener(RoomEvent.Receipt, onConversationReceipt);
  client.removeListener(RoomEvent.MyMembership, onConversationMembership);
  client.removeListener(MatrixEventEvent.Decrypted, onConversationDecrypted);
  window.removeEventListener(
    CONVERSATION_UNREAD_EVENT,
    onConversationUnreadEvent,
  );
  releaseSignalRooms?.();
  releaseSignalRooms = null;
  cancelConversationPump();
  if (listeningClient === client) listeningClient = null;
}

function useConversationClient(client: MatrixClient) {
  if (conversationClient === client) return;
  if (listeningClient) stopListeningForConversationRows(listeningClient);
  conversationClient = client;
  conversationCache.clear();
  conversationQueue = [];
  cancelConversationPump();
}

export function conversationRowsSnapshot(client: MatrixClient) {
  const rows: ConversationRow[] = [];
  for (const room of client.getRooms()) {
    const row = conversationCache.get(room.roomId)?.row;
    if (row) rows.push(row);
  }
  return sortConversationRows(rows);
}

export function conversationUnreadSnapshot(client: MatrixClient) {
  let total = 0;
  for (const room of client.getRooms()) {
    total += conversationCache.get(room.roomId)?.row?.unread ?? 0;
  }
  return total;
}

/** Keep a listener on the shared room summaries and fill any room still missing. */
export function attachConversationList(
  client: MatrixClient,
  onChange: () => void,
) {
  useConversationClient(client);
  conversationListeners.add(onChange);
  listenForConversationRows(client);
  enqueueConversationRooms(client, []);
  scheduleConversationPump();
  onChange();
  return () => {
    conversationListeners.delete(onChange);
    if (conversationListeners.size === 0 && listeningClient) {
      stopListeningForConversationRows(listeningClient);
    }
  };
}

/** Move these people's direct rooms to the front and build them immediately. */
export function prioritizeConversationRooms(
  client: MatrixClient,
  matrixUserIds: readonly string[],
) {
  if (matrixUserIds.length === 0) return;
  useConversationClient(client);
  const roomIds = priorityRoomIds(client, matrixUserIds);
  enqueueConversationRooms(client, roomIds);
  pumpConversationRooms(
    Math.min(SYNC_ROOM_BUDGET, Math.max(roomIds.length, 1)),
  );
}

export function readConversationRows(client: MatrixClient): ConversationRow[] {
  useConversationClient(client);
  const rows: ConversationRow[] = [];
  for (const room of client.getRooms()) {
    const row = cachedConversation(client, room).row;
    if (row) rows.push(row);
  }
  return sortConversationRows(rows);
}

export function sumConversationUnread(client: MatrixClient | null) {
  if (!client) return 0;
  return conversationUnreadSnapshot(client);
}

export { notifyConversationUnreadChanged };

export function useConversationUnreadCount() {
  const { client } = useMatrix();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!client) {
      setCount(0);
      return;
    }
    let timer = 0;
    let stopped = false;
    const publish = () => {
      timer = 0;
      if (stopped) return;
      const next = conversationUnreadSnapshot(client);
      setCount((prev) => (prev === next ? prev : next));
    };
    // Coalesce, but do not keep postponing: the total should climb as each
    // chunk of rooms is summarised, not after the last person in the backlog.
    const schedule = () => {
      if (timer) return;
      timer = window.setTimeout(publish, 150);
    };
    const unsubscribe = attachConversationList(client, schedule);
    publish();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      unsubscribe();
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

export function MyConnections({
  section = 'messages',
}: {
  /** Messages is the conversation list. Suggestions is its own screen. */
  section?: 'messages' | 'suggestions';
}) {
  const t = useTranslations('Connections');
  const tChat = useTranslations('MemberHome');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const { jwt } = useJwt();
  const { client, isMatrixAvailable, createRoom } = useMatrix();
  const { openCoherenceChat } = useHumanChatPanel();
  const searchParams = useSearchParams();
  const openedDirectChatRef = useRef<string | null>(null);
  const openChatRef = useRef<MemberHomeOpenChat | null>(null);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [synced, setSynced] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [picking, setPicking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pendingGroups, setPendingGroups] = useState<ConversationRow[]>([]);
  const [directory, setDirectory] = useState<ConnectionPerson[] | null>(null);
  const [searchDirectory, setSearchDirectory] = useState<
    ConnectionPerson[] | null
  >(null);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [directoryComplete, setDirectoryComplete] = useState(false);
  const suggestionPoolRequested = useRef(false);

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
    personIds: [
      ...listed.map((person) => person.id),
      ...(home?.person.id != null ? [home.person.id] : []),
    ],
  });
  const matrixIdsRef = useRef(personIdToMatrixUserId);
  matrixIdsRef.current = personIdToMatrixUserId;
  const visibleMatrixKey = useMemo(
    () =>
      Object.values(personIdToMatrixUserId)
        .filter((id): id is string => Boolean(id))
        .sort()
        .join('\n'),
    [personIdToMatrixUserId],
  );

  useEffect(() => {
    const chat = searchParams.get('chat')?.trim();
    if (!chat || searchParams.get('signal')?.trim()) return;
    const key = `${chat}:${searchParams.get('msg')?.trim() ?? ''}`;
    if (openedDirectChatRef.current === key) return;
    openedDirectChatRef.current = key;
    openCoherenceChat(chat, '', '', null, null);
  }, [openCoherenceChat, searchParams]);

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
    if (section !== 'suggestions' || !jwt || suggestionPoolRequested.current) {
      return;
    }
    suggestionPoolRequested.current = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/v1/people/me/intelligence?connections=${SUGGESTION_POOL}`,
          {
            headers: { Authorization: `Bearer ${jwt}` },
            signal: controller.signal,
          },
        );
        if (!response.ok) return;
        const body = (await response.json()) as MemberIntelligence;
        if (controller.signal.aborted) return;
        const page = body.connections ?? [];
        if (page.length === 0) return;
        setDirectory(page);
        if (page.length >= (body.counts?.connections ?? page.length)) {
          setDirectoryComplete(true);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        suggestionPoolRequested.current = false;
      }
    })();
    return () => {
      controller.abort();
      suggestionPoolRequested.current = false;
    };
  }, [jwt, section]);

  useEffect(() => {
    if (!client) {
      setRows([]);
      setSynced(false);
      return;
    }
    return attachConversationList(client, () => {
      setRows((current) => {
        const next = conversationRowsSnapshot(client);
        return sameConversationRows(current, next) ? current : next;
      });
      const state = client.getSyncState();
      if (state === SyncState.Prepared || state === SyncState.Syncing) {
        setSynced(true);
      }
    });
  }, [client]);

  useEffect(() => {
    if (!client) return;
    const ids = Object.values(matrixIdsRef.current).filter((id): id is string =>
      Boolean(id),
    );
    prioritizeConversationRooms(client, ids);
  }, [client, visibleMatrixKey]);

  useEffect(() => {
    rememberSignalThreadRooms(
      (home?.signals ?? []).map((signal) => signal.roomId),
    );
  }, [home?.signals]);

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
      members.map((row) => ({
        ...row,
        lastTs: connectionActivityTs(row.lastTs, row.preview),
      })),
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
    const profiles = new Map<string, { name: string; avatarUrl?: string }>();
    const mentionNames = new Map<string, string>();
    const rememberName = (mxid: string, name: string) => {
      const clean = name.trim();
      const id = mxid.trim();
      if (!id || !clean) return;
      if (looksLikeTechnicalMatrixDisplayName(clean, id)) return;
      mentionNames.set(id.toLowerCase(), clean);
      const local = id.replace(/^@/, '').split(':')[0]?.toLowerCase();
      if (local) mentionNames.set(local, clean);
    };
    for (const row of members) {
      const mxid = personIdToMatrixUserId[row.person.id];
      if (!mxid) continue;
      const avatar = row.avatarUrl || row.person.avatarUrl || undefined;
      profiles.set(mxid.toLowerCase(), {
        name: row.name,
        avatarUrl: avatar || undefined,
      });
      rememberName(mxid, row.name);
    }
    if (home?.person) {
      const mxid = personIdToMatrixUserId[home.person.id];
      const selfName = [home.person.name, home.person.surname]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (mxid && selfName) rememberName(mxid, selfName);
    }
    const liveGroupIds = new Set(
      rows.filter((row) => row.kind === 'group').map((row) => row.roomId),
    );
    const conversations = [
      ...rows.map((row) => {
        if (row.kind !== 'group') return row;
        const pending = pendingGroups.find(
          (group) => group.roomId === row.roomId,
        );
        const faces =
          row.faces && row.faces.length >= 2 ? row.faces : pending?.faces;
        return {
          ...row,
          name: row.name.trim() || pending?.name || row.name,
          faces: facesWithProfiles(faces, profiles),
          lastTs: row.lastTs ?? pending?.lastTs ?? row.lastTs,
        };
      }),
      ...pendingGroups
        .filter((group) => !liveGroupIds.has(group.roomId))
        .map((group) => ({
          ...group,
          faces: facesWithProfiles(group.faces, profiles),
        })),
    ];
    for (const row of conversations) {
      for (const face of row.faces ?? []) {
        if (face.userId && face.name) rememberName(face.userId, face.name);
      }
    }
    const groups = picking
      ? []
      : groupRowsForConnections<ConnectionPerson>(conversations, t('someone'));
    const source = [...groups, ...members];
    const filtered = needle
      ? source.filter((row) => {
          const haystack = [row.name, row.person.nickname, row.person.slug]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(needle);
        })
      : source;
    const named = filtered.map((row) => ({
      ...row,
      preview: previewWithNames(row.preview, mentionNames),
    }));
    return sortByRecencyThenPresence(named, presenceById);
  }, [
    home?.person,
    members,
    needle,
    pendingGroups,
    personIdToMatrixUserId,
    picking,
    presenceById,
    rows,
    t,
  ]);
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
    if (row.person.id < 0 && row.roomId) {
      openCoherenceChat(row.roomId, row.name, '', null, null);
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

  async function startGroupChat() {
    if (selectedPeople.length < 2 || starting) return;
    setStarting(true);
    setNotice(null);
    const title = selectedPeople.map((row) => row.name).join(', ');
    const faces = selectedPeople.slice(0, 2).map((row) => ({
      name: row.name,
      avatarUrl: row.avatarUrl,
    }));
    try {
      const { roomId } = await createRoom(title);
      if (client) {
        for (const row of selectedPeople) {
          const mxid = personIdToMatrixUserId[row.person.id];
          if (!mxid) continue;
          await client.invite(roomId, mxid).catch(() => undefined);
        }
      }
      setPendingGroups((current) => [
        {
          roomId,
          name: title,
          preview: '',
          mine: false,
          lastTs: Date.now(),
          unread: 0,
          memberCount: selectedPeople.length + 1,
          otherUserId: null,
          kind: 'group',
          groupChat: true,
          faces,
        },
        ...current.filter((group) => group.roomId !== roomId),
      ]);
      rememberGroupChatRooms([roomId]);
      openCoherenceChat(roomId, title, '', null, null);
      exitPicking();
    } catch {
      setNotice(tChat('matrixFailed'));
    } finally {
      setStarting(false);
    }
  }

  async function openReachOut(card: ConnectionSuggestion) {
    setNotice(null);
    if (!card.person) {
      if (!card.roomId) return;
      openCoherenceChat(card.roomId, card.name, '', null, null);
      return;
    }
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

      {section === 'suggestions' ? (
        <section className="flex flex-col gap-3" aria-label={t('reachOut')}>
          <p className="text-2 text-muted-foreground">{t('suggestSentence')}</p>
          {reachOut.length === 0 ? (
            <p className="text-2 text-muted-foreground">
              {t('suggestionsEmpty')}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {reachOut.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => void openReachOut(card)}
                  className="flex min-w-0 flex-col items-start gap-2 rounded-none border border-border p-3 text-left hover:bg-accent-2"
                >
                  <PersonAvatar
                    size="chat"
                    shape="circle"
                    avatarSrc={card.avatarUrl}
                    userName={card.name}
                    personId={card.person.id}
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
          )}
        </section>
      ) : null}

      {section === 'messages' ? (
        <>
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
                  className="h-10 w-full rounded-none border border-border bg-background pr-3 pl-10 text-2 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
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
                  <Users className="size-3.5" strokeWidth={1.5} aria-hidden />
                  {t('groupCall')}
                </Button>
              )}
            </div>

            {picking && selectedPeople.length > 0 ? (
              <div
                className="flex gap-3 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-label={t('selectedCount', {
                  count: selectedPeople.length,
                })}
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
                        personId={row.person.id}
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
                  disabled={selectedPeople.length < 2 || starting}
                  className="shrink-0 gap-1.5"
                  onClick={() => void startGroupChat()}
                >
                  <Users className="size-3.5" strokeWidth={1.5} aria-hidden />
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
        </>
      ) : null}
    </div>
  );
}

function GroupFaces({ faces }: { faces: GroupFace[] }) {
  const shown = faces.slice(0, 2);
  return (
    <span className="relative block h-10 w-10 shrink-0" aria-hidden>
      {shown.map((face, index) => (
        <span
          key={`${face.name}-${index}`}
          className={cn(
            'absolute block size-[22px] overflow-hidden rounded-full bg-neutral-3 ring-2 ring-background group-hover/row:ring-accent-2',
            index === 0 ? 'top-0 left-0' : 'right-0 bottom-0',
          )}
        >
          {face.avatarUrl ? (
            <img
              src={face.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] font-medium text-neutral-11">
              {face.name.replace(/^@/, '').trim().charAt(0).toUpperCase() ||
                '?'}
            </span>
          )}
        </span>
      ))}
    </span>
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
    <section className="overflow-hidden rounded-none border border-border bg-background">
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
              key={row.roomId ?? row.person.id}
              className="border-b border-border last:border-b-0"
            >
              <button
                type="button"
                onClick={() => onOpen(row)}
                aria-pressed={picking ? checked : undefined}
                aria-label={picking ? selectLabel(row.name) : undefined}
                className={cn(
                  'group/row flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left hover:bg-accent-2',
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
                {row.faces && row.faces.length > 0 ? (
                  <GroupFaces faces={row.faces} />
                ) : (
                  <PersonAvatar
                    size="chat"
                    shape="circle"
                    avatarSrc={row.avatarUrl}
                    userName={row.name}
                    personId={row.person.id}
                    presence={presence}
                  />
                )}
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
