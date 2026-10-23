'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import useSWR from 'swr';
import {
  ClientEvent,
  EventType,
  MatrixEventEvent,
  NotificationCountType,
  RoomEvent,
  RoomStateEvent,
  SyncState,
  type MatrixClient,
  type MatrixEvent,
  type Room,
} from 'matrix-js-sdk';
import {
  GROUP_ROOM_ARCHIVED_STATE,
  GROUP_ROOM_CREATOR_STATE,
  HYPHA_ROOM_TYPES,
  conversationActivityTs,
  countCommaSeparatedNames,
  isArchivedGroupRoom,
  isGroupCreateContent,
  peopleConversationKindForListing,
  readCreateContent,
  resolveConversationCacheEntry,
  readRoomNameState,
  looksLikeTechnicalMatrixDisplayName,
  matrixMemberDisplayLabel,
  matrixUserIdToCanonicalPrivySub,
  sortConversationsByLastMessage,
  uniqueCanonicalPrivySubsFromMxids,
  visibleMatrixMemberName,
  useJwt,
  useMatrix,
  useMatrixUserIdsByPersonIds,
  usePeopleBySubs,
  type MemberIntelligence,
} from '@hypha-platform/core/client';
import { listBoundChatRoomIdsAmongAction } from '@hypha-platform/core/matrix/server/actions';
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
  conversationMatchesSearch,
  peopleMatchingSearch,
  conversationsVisibleInSection,
  enrichSearchMembers,
  isPeopleListGroup,
  isRememberedBoundChatRoom,
  isRememberedGroupChatRoom,
  memberRowsForConnections,
  messagePreview,
  previewWithNames,
  rememberGroupChatMembers,
  rememberBoundChatRooms,
  rememberGroupChatRooms,
  rememberedGroupChatMemberIds,
  rememberSignalThreadRooms,
  subscribeSignalThreadRooms,
  unreadRoomsMissingFromMembers,
  STALE_CONNECTION_MS,
  connectionActivityTs,
  collectDirectPairRoomHints,
  conversationUnreadTotal,
  orphanedDirectRoomIds,
  readRememberedDirectRoom,
  suggestConnections,
  supersededDirectRoomIds,
  type ConnectionSuggestion,
  type ConversationRow,
  type GroupFace,
  type MemberRow,
  type NewcomerCandidate,
} from './member-connections';
import { type PresenceLevel } from './member-presence';
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
      const label = matrixMemberDisplayLabel(member, matrixUserId);
      if (looksLikeTechnicalMatrixDisplayName(label, matrixUserId)) return '';
      return label;
    });
    if (!preview) continue;
    const sender = event.getSender();
    return {
      preview,
      mine: Boolean(selfId && sender === selfId),
      ts: conversationActivityTs(event.getTs()),
    };
  }
  return {
    preview: '',
    mine: false,
    ts: null,
  };
}

function debugRoomsEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    return (
      new URLSearchParams(window.location.search).get('debugRooms') === '1'
    );
  } catch {
    return false;
  }
}

function logDroppedRoom(room: Room, details: Record<string, unknown>): null {
  if (debugRoomsEnabled()) {
    console.debug('[debugRooms] dropped', {
      roomId: room.roomId,
      roomName: room.name,
      roomType: room.getType() ?? null,
      membership: room.getMyMembership(),
      ...details,
    });
  }
  return null;
}

export type RoomListingInspection = {
  roomId: string;
  name: string;
  nameState: string | null;
  roomType: string | null;
  membership: string;
  loadedHumanCount: number;
  summaryJoinedCount: number;
  othersCount: number;
  titleMemberHint: number;
  rememberedHumanCount: number;
  archived: boolean;
  createdAsGroup: boolean;
  kind: 'group' | 'person' | null;
  listed: boolean;
  cached: boolean;
  reason: string;
};

function inspectBase(room: Room, client: MatrixClient) {
  const membership = room.getMyMembership() || '';
  const roomType = room.getType() ?? null;
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
  const nameState = readRoomNameState(room);
  const titleMemberHint = countCommaSeparatedNames(
    nameState || room.name || '',
  );
  const rememberedHumanCount =
    rememberedGroupChatMemberIds(room.roomId).length + (selfId ? 1 : 0);
  const createdAsGroup = isGroupCreateContent(readCreateContent(room));
  const archived = isArchivedGroupRoom(room);
  return {
    membership,
    roomType,
    members,
    others,
    nameState,
    titleMemberHint,
    rememberedHumanCount,
    createdAsGroup,
    archived,
    selfId,
    loadedHumanCount: members.length,
    summaryJoinedCount: room.getJoinedMemberCount?.() ?? members.length,
  };
}

function inspectionFrom(
  room: Room,
  base: ReturnType<typeof inspectBase>,
  reason: string,
  kind: 'group' | 'person' | null,
  listed: boolean,
): RoomListingInspection {
  return {
    roomId: room.roomId,
    name: (base.nameState || room.name || '').trim(),
    nameState: base.nameState,
    roomType: base.roomType,
    membership: base.membership,
    loadedHumanCount: base.loadedHumanCount,
    summaryJoinedCount: base.summaryJoinedCount,
    othersCount: base.others.length,
    titleMemberHint: base.titleMemberHint,
    rememberedHumanCount: base.rememberedHumanCount,
    archived: base.archived,
    createdAsGroup: base.createdAsGroup,
    kind,
    listed,
    cached: false,
    reason,
  };
}

function classifyConversationRoom(
  client: MatrixClient,
  room: Room,
): { row: ConversationRow | null; inspection: RoomListingInspection } {
  const base = inspectBase(room, client);
  const drop = (reason: string, kind: 'group' | 'person' | null = null) => ({
    row: null as ConversationRow | null,
    inspection: inspectionFrom(room, base, reason, kind, false),
  });
  if (base.membership !== 'join') {
    return drop('not-joined');
  }
  if (isRememberedBoundChatRoom(room.roomId)) {
    const typed = base.roomType?.trim() || null;
    // Untyped people groups can be cached as bound by mistake. Only trust
    // the cache for other Hypha room types (space, signal, …).
    if (
      typed &&
      typed.startsWith('io.hypha.room.') &&
      typed !== HYPHA_ROOM_TYPES.dm &&
      typed !== HYPHA_ROOM_TYPES.group
    ) {
      return drop('space-or-signal');
    }
  }
  // Space, signal, proposal, public, network and ecosystem rooms are not
  // private conversations, whoever is in them.
  if (
    base.roomType?.startsWith('io.hypha.room.') &&
    base.roomType !== HYPHA_ROOM_TYPES.dm &&
    base.roomType !== HYPHA_ROOM_TYPES.group
  ) {
    return drop('hypha-typed');
  }
  const overrideName = conversationTitleOverrides.get(room.roomId)?.trim();
  const kind = peopleConversationKindForListing({
    roomType: base.roomType,
    loadedHumanCount: base.loadedHumanCount,
    summaryJoinedCount: base.summaryJoinedCount,
    createdAsGroup: base.createdAsGroup,
    hasRoomName: Boolean(base.nameState) || base.titleMemberHint > 2,
    titleMemberHint: base.titleMemberHint,
    rememberedHumanCount: base.rememberedHumanCount,
  });
  if (
    !base.roomType &&
    (base.nameState || base.titleMemberHint > 1) &&
    base.members.length < 3 &&
    typeof room.loadMembersIfNeeded === 'function'
  ) {
    void room.loadMembersIfNeeded().catch(() => undefined);
  }
  // Group-typed rooms stay listed before lazy members arrive. Person chats
  // still need the other human so they can attach to a directory row.
  if (base.others.length === 0 && kind !== 'group') {
    return drop('no-other-members', kind);
  }
  // Untyped rooms that are not groups are dropped. If they were also in
  // m.direct they used to become `person` and then vanish from the list.
  if (!kind) {
    return drop('not-people-conversation');
  }
  const other = base.others.length === 1 ? base.others[0] : undefined;
  const name =
    overrideName ||
    (kind === 'person'
      ? other?.name || other?.rawDisplayName
      : base.nameState || room.name) ||
    room.name ||
    base.nameState ||
    '';
  if (overrideName && room.name.trim() === overrideName) {
    conversationTitleOverrides.delete(room.roomId);
  }
  if (
    isHyphaBot(other?.userId, name) ||
    looksLikeHyphaBot(room.name) ||
    looksLikeHyphaBot(name)
  ) {
    return drop('bot', kind);
  }
  const mxc =
    kind === 'person'
      ? other?.getMxcAvatarUrl() || room.getMxcAvatarUrl()
      : room.getMxcAvatarUrl();
  const faces =
    kind === 'group'
      ? base.others.slice(0, 2).map((member) => ({
          name: visibleMatrixMemberName(
            member.userId,
            member.name,
            member.rawDisplayName,
          ),
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
    return drop('signal', kind);
  }
  const last = lastRoomMessage(room, base.selfId);
  // Always walk real incoming messages. The SDK notification total still
  // counts hidden call/signal notices, which inflated the Messages badge.
  const unread = countIncomingUnreadMessages(room, base.selfId, isHyphaBot);
  const searchMembers =
    kind === 'group'
      ? base.others.map((member) => ({
          name: visibleMatrixMemberName(
            member.userId,
            member.name,
            member.rawDisplayName,
          ),
          userId: member.userId,
        }))
      : undefined;

  const row: ConversationRow = {
    roomId: room.roomId,
    name: name.trim(),
    avatarUrl: avatarHttp(client, mxc),
    preview: last.preview,
    mine: last.mine,
    lastTs: last.ts ?? (kind === 'group' ? groupFallbackTimestamp(room) : null),
    unread,
    memberCount: base.members.length,
    otherUserId: other?.userId ?? null,
    roomType: room.getType() ?? null,
    faces,
    groupChat: kind === 'group' && isRememberedGroupChatRoom(room.roomId),
    kind,
    archived: base.archived,
    searchMembers,
  };
  if (kind === 'group' && !isPeopleListGroup(row)) {
    return drop('not-people-group', kind);
  }
  return {
    row,
    inspection: inspectionFrom(
      room,
      base,
      base.archived ? 'listed-archived' : 'listed',
      kind,
      true,
    ),
  };
}

function conversationRowFromRoom(
  client: MatrixClient,
  room: Room,
): ConversationRow | null {
  const { row, inspection } = classifyConversationRoom(client, room);
  if (!row) {
    logDroppedRoom(room, inspection);
  }
  return row;
}

/** Every joined or invited room, with the Messages-list filter reason. */
export function inspectJoinedAndInvitedRooms(
  client: MatrixClient,
): RoomListingInspection[] {
  return client
    .getRooms()
    .filter((room) => {
      const membership = room.getMyMembership();
      return membership === 'join' || membership === 'invite';
    })
    .map((room) => {
      if (room.getMyMembership() === 'join') {
        cachedConversation(client, room);
      }
      const inspection = classifyConversationRoom(client, room).inspection;
      return {
        ...inspection,
        cached: Boolean(conversationCache.get(room.roomId)?.row),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function logRoomListingDump(client: MatrixClient) {
  if (!debugRoomsEnabled()) return;
  console.info('[debugRooms] joined and invited rooms', {
    rooms: inspectJoinedAndInvitedRooms(client),
  });
}

function groupFallbackTimestamp(room: Room): number | null {
  const create = room.currentState?.getStateEvents?.('m.room.create', '');
  const event = Array.isArray(create) ? create[0] : create;
  const createdTs =
    event && typeof event.getTs === 'function' ? event.getTs() : 0;
  if (createdTs > 0) return createdTs;
  if (typeof room.getLastActiveTimestamp === 'function') {
    const active = room.getLastActiveTimestamp();
    if (active > 0) return active;
  }
  return null;
}

function sortConversationRows(rows: ConversationRow[]) {
  return sortConversationsByLastMessage(rows);
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
      current.name !== next.name ||
      current.archived !== next.archived
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
const conversationTitleOverrides = new Map<string, string>();
const conversationListeners = new Set<() => void>();
let conversationClient: MatrixClient | null = null;
let listeningClient: MatrixClient | null = null;
let conversationQueue: string[] = [];
let conversationPump: number | null = null;
let conversationPumpIdle = false;
let conversationNotifyQueued = false;
let releaseSignalRooms: (() => void) | null = null;
/** Event already receipted in an earlier pair room, so a refresh does not send it again. */
const supersededReadEventIds = new Map<string, string>();
let supersededReadTimer = 0;

function latestReceiptEvent(room: Room) {
  const events = room.getLiveTimeline().getEvents();
  // Prefer the latest room message so every earlier unread line is covered.
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event) continue;
    if (event.getType() !== EventType.RoomMessage) continue;
    const id = event.getId();
    if (!id || id.startsWith('~')) continue;
    if (event.status) continue;
    return event;
  }
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event) continue;
    const id = event.getId();
    if (!id || id.startsWith('~')) continue;
    if (event.status) continue;
    return event;
  }
  return null;
}

function clearLocalUnread(room: Room) {
  if (typeof room.setUnreadNotificationCount !== 'function') return;
  room.setUnreadNotificationCount(NotificationCountType.Total, 0);
  room.setUnreadNotificationCount(NotificationCountType.Highlight, 0);
}

function scheduleSupersededDirectRead() {
  if (typeof window === 'undefined' || supersededReadTimer) return;
  supersededReadTimer = window.setTimeout(() => {
    supersededReadTimer = 0;
    void markSupersededDirectRoomsRead();
  }, 400);
}

function directPairHintsFromClient(client: MatrixClient) {
  const selfId = client.getUserId();
  const botId = botUserId();
  const rooms = client
    .getRooms()
    .filter((room) => room.getType() === HYPHA_ROOM_TYPES.dm)
    .map((room) => {
      let members: {
        userId: string;
        name?: string;
        rawDisplayName?: string;
      }[] = [];
      try {
        members = room.getJoinedMembers();
      } catch {
        members = [];
      }
      const others = members
        .filter((member) => {
          if (!member.userId || member.userId === selfId) return false;
          if (member.userId === botId) return false;
          return !isHyphaBot(
            member.userId,
            member.name || member.rawDisplayName,
          );
        })
        .map((member) => member.userId);
      const signalThread =
        isRememberedSignalThreadRoom(room.roomId) ||
        room
          .getLiveTimeline()
          .getEvents()
          .slice(-12)
          .some(
            (event) =>
              event.getType() === EventType.RoomMessage &&
              eventContentIsSignalThread(
                event.getContent() as Record<string, unknown> | null,
              ),
          );
      return {
        roomId: room.roomId,
        membership: room.getMyMembership(),
        lastTs:
          typeof room.getLastActiveTimestamp === 'function'
            ? room.getLastActiveTimestamp()
            : 0,
        otherUserIds: others,
        signalThread,
      };
    });
  return collectDirectPairRoomHints(rooms);
}

function rememberedRoomByOther(client: MatrixClient) {
  const selfId = client.getUserId();
  const map = new Map<string, string>();
  if (!selfId) return map;
  for (const hint of directPairHintsFromClient(client)) {
    const key = hint.otherUserId.toLowerCase();
    if (map.has(key)) continue;
    const remembered = readRememberedDirectRoom(selfId, hint.otherUserId);
    if (remembered) map.set(key, remembered);
  }
  return map;
}

function orphanDirectRoomIdsForClient(client: MatrixClient) {
  const rows: ConversationRow[] = [];
  for (const room of client.getRooms()) {
    const row = conversationCache.get(room.roomId)?.row;
    if (row) rows.push(row);
  }
  return [
    ...new Set([
      ...supersededDirectRoomIds(rows),
      ...orphanedDirectRoomIds(
        directPairHintsFromClient(client),
        rememberedRoomByOther(client),
      ),
    ]),
  ];
}

async function markSupersededDirectRoomsRead() {
  const client = conversationClient;
  if (!client) return;
  let marked = false;
  for (const roomId of orphanDirectRoomIdsForClient(client)) {
    const cachedUnread = conversationCache.get(roomId)?.row?.unread ?? 0;
    const room = client.getRoom(roomId);
    if (!room || room.getMyMembership() !== 'join') continue;
    const syncUnread =
      typeof room.getUnreadNotificationCount === 'function'
        ? room.getUnreadNotificationCount(NotificationCountType.Total)
        : 0;
    const incomingUnread = countIncomingUnreadMessages(
      room,
      client.getUserId(),
      isHyphaBot,
    );
    if (cachedUnread <= 0 && syncUnread <= 0 && incomingUnread <= 0) continue;
    const event = latestReceiptEvent(room);
    const eventId = event?.getId();
    if (!event || !eventId) continue;
    if (
      supersededReadEventIds.get(roomId) === eventId &&
      syncUnread <= 0 &&
      incomingUnread <= 0
    ) {
      continue;
    }
    supersededReadEventIds.set(roomId, eventId);
    try {
      await client.setRoomReadMarkers(roomId, eventId, event);
      clearLocalUnread(room);
      conversationCache.delete(roomId);
      marked = true;
    } catch (error) {
      supersededReadEventIds.delete(roomId);
      console.warn('Failed to mark an earlier direct room read', error);
    }
  }
  if (marked) notifyConversationUnreadChanged();
}

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
    room.getType() ?? '',
    readRoomNameState(room) ?? '',
    room.getJoinedMemberCount?.() ?? 0,
    room.getMembers?.().length ?? 0,
    isArchivedGroupRoom(room) ? '1' : '0',
    room.name || '',
  ].join(':');
}

function cachedConversation(client: MatrixClient, room: Room) {
  const stamp = roomStamp(room, client.getUserId());
  const entry = resolveConversationCacheEntry(
    conversationCache.get(room.roomId),
    stamp,
    () => conversationRowFromRoom(client, room),
  );
  conversationCache.set(room.roomId, entry);
  return entry;
}

function conversationIsFresh(client: MatrixClient, room: Room) {
  const hit = conversationCache.get(room.roomId);
  if (!hit) return false;
  return hit.stamp === roomStamp(room, client.getUserId());
}

function peopleGroupRoomIds(client: MatrixClient): string[] {
  const ids: string[] = [];
  for (const room of client.getRooms()) {
    const membership = room.getMyMembership();
    if (membership !== 'join') continue;
    if (room.getType() === HYPHA_ROOM_TYPES.group) {
      ids.push(room.roomId);
      continue;
    }
    if (isGroupCreateContent(readCreateContent(room))) {
      ids.push(room.roomId);
      continue;
    }
    if (isRememberedGroupChatRoom(room.roomId)) {
      ids.push(room.roomId);
      continue;
    }
    if (
      !room.getType() &&
      (readRoomNameState(room) || countCommaSeparatedNames(room.name) > 2)
    ) {
      ids.push(room.roomId);
    }
  }
  return ids;
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
        if (room.getType() !== HYPHA_ROOM_TYPES.dm) continue;
        found.set(matrixUserId.toLowerCase(), room.roomId);
        break;
      }
    }
  }
  if (found.size < wanted.size) {
    const selfId = client.getUserId();
    for (const room of client.getRooms()) {
      if (room.getMyMembership() !== 'join') continue;
      if (room.getType() !== HYPHA_ROOM_TYPES.dm) continue;
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
    scheduleSupersededDirectRead();
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
  if (done > 0 || conversationQueue.length === 0) {
    notifyConversationListeners();
  }
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

const MAX_BOUND_LOOKUP_IDS = 100;
const checkedBoundRoomIds = new Set<string>();
let conversationBoundLookupToken: string | null = null;
let boundLookupInFlight = false;

function setConversationBoundLookupToken(token: string | null | undefined) {
  conversationBoundLookupToken = token?.trim() || null;
}

function refreshBoundChatRooms(client: MatrixClient) {
  const authToken = conversationBoundLookupToken;
  if (!authToken) return;
  if (boundLookupInFlight) return;
  const roomIds = client
    .getRooms()
    .map((room) => room.roomId)
    .filter((id) => !checkedBoundRoomIds.has(id));
  if (roomIds.length === 0) return;
  boundLookupInFlight = true;
  void (async () => {
    try {
      for (let i = 0; i < roomIds.length; i += MAX_BOUND_LOOKUP_IDS) {
        const chunk = roomIds.slice(i, i + MAX_BOUND_LOOKUP_IDS);
        const ids = await listBoundChatRoomIdsAmongAction(chunk, {
          authToken,
        });
        for (const id of chunk) checkedBoundRoomIds.add(id);
        rememberBoundChatRooms(ids);
        let changed = false;
        for (const id of ids) {
          if (!conversationCache.has(id)) continue;
          conversationCache.delete(id);
          const room = client.getRoom(id);
          if (room) cachedConversation(client, room);
          changed = true;
        }
        if (changed) notifyConversationListeners();
      }
    } catch (error) {
      console.warn('Failed to check bound chat rooms', error);
    } finally {
      boundLookupInFlight = false;
    }
  })();
}

function onConversationSync() {
  const client = conversationClient;
  if (!client) return;
  refreshBoundChatRooms(client);
  logRoomListingDump(client);
  enqueueConversationRooms(client, peopleGroupRoomIds(client));
  // Summarise enough rooms on this tick that last-message order is already
  // correct before the list paints. The idle pump finishes any remainder.
  pumpConversationRooms(SYNC_ROOM_BUDGET);
  scheduleConversationPump();
  notifyConversationListeners();
}

function onConversationState(event: MatrixEvent) {
  const type = event.getType();
  if (
    type !== EventType.RoomName &&
    type !== GROUP_ROOM_ARCHIVED_STATE &&
    type !== GROUP_ROOM_CREATOR_STATE
  ) {
    return;
  }
  const roomId = event.getRoomId();
  if (!roomId || !conversationClient) return;
  refreshConversationRoom(conversationClient.getRoom(roomId) ?? undefined);
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
  client.on(RoomStateEvent.Events, onConversationState);
  client.on(MatrixEventEvent.Decrypted, onConversationDecrypted);
  window.addEventListener(CONVERSATION_UNREAD_EVENT, onConversationUnreadEvent);
  releaseSignalRooms = subscribeSignalThreadRooms(onConversationSignals);
}

function stopListeningForConversationRows(client: MatrixClient) {
  client.removeListener(ClientEvent.Sync, onConversationSync);
  client.removeListener(RoomEvent.Timeline, onConversationTimeline);
  client.removeListener(RoomEvent.Receipt, onConversationReceipt);
  client.removeListener(RoomEvent.MyMembership, onConversationMembership);
  client.removeListener(RoomStateEvent.Events, onConversationState);
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
  checkedBoundRoomIds.clear();
  conversationCache.clear();
  conversationTitleOverrides.clear();
  supersededReadEventIds.clear();
  if (supersededReadTimer) {
    window.clearTimeout(supersededReadTimer);
    supersededReadTimer = 0;
  }
  conversationQueue = [];
  cancelConversationPump();
}

/**
 * True while any joined room has not been summarised yet. Judged from the
 * cache itself, so there is no gap between the first sync and the queue filling.
 */
export function conversationRowsPending(client: MatrixClient) {
  if (conversationQueue.length > 0 || conversationPump != null) return true;
  return client
    .getRooms()
    .some(
      (room) =>
        room.getMyMembership() === 'join' && !conversationIsFresh(client, room),
    );
}

/** Apply a group rename to the list immediately, before Matrix echoes `m.room.name`. */
export function applyConversationRoomTitle(roomId: string, name: string) {
  const id = roomId.trim();
  const title = name.trim();
  if (!id || !title) return;
  rememberGroupChatRooms([id]);
  conversationTitleOverrides.set(id, title);
  const client = conversationClient;
  if (!client) {
    notifyConversationListeners();
    return;
  }
  conversationCache.delete(id);
  const room = client.getRoom(id);
  if (room) cachedConversation(client, room);
  notifyConversationListeners();
}

export function conversationRowsSnapshot(client: MatrixClient) {
  const rows: ConversationRow[] = [];
  for (const room of client.getRooms()) {
    if (room.getMyMembership() !== 'join') continue;
    const row = cachedConversation(client, room).row;
    if (row) rows.push(row);
  }
  return sortConversationRows(rows);
}

export function conversationUnreadSnapshot(client: MatrixClient) {
  const rows: ConversationRow[] = [];
  for (const room of client.getRooms()) {
    if (room.getMyMembership() !== 'join') continue;
    const row = conversationCache.get(room.roomId)?.row;
    if (row) rows.push(row);
  }
  return conversationUnreadTotal(
    rows,
    orphanedDirectRoomIds(
      directPairHintsFromClient(client),
      rememberedRoomByOther(client),
    ),
  );
}

/** Keep a listener on the shared room summaries and fill any room still missing. */
export function attachConversationList(
  client: MatrixClient,
  onChange: () => void,
) {
  useConversationClient(client);
  conversationListeners.add(onChange);
  listenForConversationRows(client);
  refreshBoundChatRooms(client);
  logRoomListingDump(client);
  enqueueConversationRooms(client, peopleGroupRoomIds(client));
  pumpConversationRooms(SYNC_ROOM_BUDGET);
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
  const roomIds = [
    ...peopleGroupRoomIds(client),
    ...priorityRoomIds(client, matrixUserIds),
  ];
  enqueueConversationRooms(client, roomIds);
  pumpConversationRooms(
    Math.min(SYNC_ROOM_BUDGET + 8, Math.max(roomIds.length, 1)),
  );
}

export function readConversationRows(client: MatrixClient): ConversationRow[] {
  useConversationClient(client);
  const rows: ConversationRow[] = [];
  for (const room of client.getRooms()) {
    if (room.getMyMembership() !== 'join') continue;
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
  /** Messages is the conversation list. Suggestions and Archived are their own screens. */
  section?: 'messages' | 'suggestions' | 'archived';
}) {
  const t = useTranslations('Connections');
  const tChat = useTranslations('MemberHome');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const { jwt } = useJwt();
  const {
    client,
    isMatrixAvailable,
    isConnecting,
    createRoom,
    ensureRoomMembers,
  } = useMatrix();
  useEffect(() => {
    setConversationBoundLookupToken(jwt);
    if (client && jwt?.trim()) refreshBoundChatRooms(client);
  }, [client, jwt]);
  const { openCoherenceChat } = useHumanChatPanel();
  const searchParams = useSearchParams();
  const debugRooms = searchParams.get('debugRooms') === '1';
  const openedDirectChatRef = useRef<string | null>(null);
  const openChatRef = useRef<MemberHomeOpenChat | null>(null);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [synced, setSynced] = useState(false);
  const [rowsPending, setRowsPending] = useState(true);
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
  const listed = needle
    ? peopleMatchingSearch(connections, searchDirectory, needle)
    : connections;
  const { personIdToMatrixUserId, isLoading: matrixIdsLoading } =
    useMatrixUserIdsByPersonIds({
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

  const ensuredGroupRoomsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!client) return;
    const targets = new Map<string, string[]>();
    const add = (roomId: string, extra: readonly (string | undefined)[]) => {
      const id = roomId.trim();
      if (!id) return;
      const known = targets.get(id) ?? rememberedGroupChatMemberIds(id);
      targets.set(id, [
        ...known,
        ...extra.flatMap((userId) => {
          const trimmed = userId?.trim();
          return trimmed ? [trimmed] : [];
        }),
      ]);
    };
    for (const row of rows) {
      if (!isPeopleListGroup(row)) continue;
      if (client.getRoom(row.roomId)?.getCanonicalAlias()?.trim()) continue;
      add(
        row.roomId,
        (row.faces ?? []).map((face) => face.userId),
      );
    }
    for (const group of pendingGroups) {
      add(
        group.roomId,
        (group.faces ?? []).map((face) => face.userId),
      );
    }
    let cancelled = false;
    void (async () => {
      for (const [roomId, memberIds] of targets) {
        if (cancelled || ensuredGroupRoomsRef.current.has(roomId)) continue;
        ensuredGroupRoomsRef.current.add(roomId);
        await ensureRoomMembers(roomId, memberIds);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, ensureRoomMembers, pendingGroups, rows]);

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
      setRowsPending(true);
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
      setRowsPending(conversationRowsPending(client));
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

  const groupMemberSubs = useMemo(
    () =>
      uniqueCanonicalPrivySubsFromMxids(
        rows.flatMap((row) =>
          row.kind === 'group'
            ? (row.searchMembers ?? []).map((member) => member.userId)
            : [],
        ),
      ),
    [rows],
  );
  const { peopleBySub, isLoading: peopleBySubLoading } = usePeopleBySubs({
    subs: groupMemberSubs,
  });

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
    const peopleByMxid = new Map<
      string,
      {
        name?: string | null;
        nickname?: string | null;
        slug?: string | null;
      }
    >();
    for (const row of rows) {
      if (row.kind !== 'group') continue;
      for (const member of row.searchMembers ?? []) {
        const mxid = member.userId?.trim();
        if (!mxid) continue;
        const sub = matrixUserIdToCanonicalPrivySub(mxid);
        const person = sub ? peopleBySub.get(sub) : undefined;
        if (!person) continue;
        const name =
          [person.name, person.surname].filter(Boolean).join(' ').trim() ||
          person.nickname?.trim() ||
          '';
        peopleByMxid.set(mxid.toLowerCase(), {
          name,
          nickname: person.nickname,
          slug: person.slug,
        });
      }
    }
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
          lastTs: row.lastTs,
          searchMembers: enrichSearchMembers(
            row.searchMembers,
            profiles,
            members,
            personIdToMatrixUserId,
            peopleByMxid,
          ),
        };
      }),
      ...pendingGroups
        .filter((group) => !liveGroupIds.has(group.roomId))
        .map((group) => ({
          ...group,
          name:
            conversationTitleOverrides.get(group.roomId)?.trim() || group.name,
          faces: facesWithProfiles(group.faces, profiles),
          archived: isArchivedGroupRoom(client?.getRoom(group.roomId)),
        })),
    ];
    for (const [mxid, profile] of peopleByMxid) {
      if (profile.name) rememberName(mxid, profile.name);
    }
    for (const row of conversations) {
      for (const face of row.faces ?? []) {
        if (face.userId && face.name) rememberName(face.userId, face.name);
      }
      for (const member of row.searchMembers ?? []) {
        if (member.userId && member.name)
          rememberName(member.userId, member.name);
      }
    }
    const groups = picking
      ? []
      : groupRowsForConnections<ConnectionPerson>(conversations, t('someone'));
    const listedGroups = conversationsVisibleInSection(
      groups,
      section === 'archived' ? 'archived' : 'messages',
    );
    const matchingGroups = needle
      ? listedGroups.filter((row) => conversationMatchesSearch(row, needle))
      : listedGroups;
    const source =
      section === 'archived' ? matchingGroups : [...matchingGroups, ...members];
    const named = source.map((row) => {
      const preview = previewWithNames(row.preview, mentionNames);
      return {
        ...row,
        preview: /privy_did_privy/i.test(preview) ? '' : preview,
      };
    });
    return sortConversationsByLastMessage(named);
  }, [
    client,
    home?.person,
    members,
    needle,
    pendingGroups,
    peopleBySub,
    personIdToMatrixUserId,
    picking,
    rows,
    section,
    t,
  ]);
  const selectedPeople = members.filter((row) => selected.has(row.person.id));
  const roomDiagnostics = useMemo(
    () => (debugRooms && client ? inspectJoinedAndInvitedRooms(client) : []),
    [client, debugRooms, rows, synced],
  );

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
    const openChat = openChatRef.current;
    if (!openChat) {
      setNotice(tChat('matrixUnavailable'));
      return;
    }
    await openChat({
      id: row.person.id,
      slug: row.person.slug,
      name: row.person.name,
      surname: row.person.surname,
      nickname: row.person.nickname,
      avatarUrl: row.person.avatarUrl,
    });
  }

  async function startGroupChat() {
    if (selectedPeople.length < 2 || starting) return;
    setStarting(true);
    setNotice(null);
    const requester = [home?.person.name, home?.person.surname]
      .filter(Boolean)
      .join(' ')
      .trim();
    const title = [requester, ...selectedPeople.map((row) => row.name)]
      .filter(Boolean)
      .join(', ');
    const faces = selectedPeople.slice(0, 2).map((row) => ({
      name: row.name,
      avatarUrl: row.avatarUrl,
    }));
    try {
      const { roomId } = await createRoom(title, {
        grantCreatorPl100: true,
        roomType: HYPHA_ROOM_TYPES.group,
      });
      const memberIds = selectedPeople.flatMap((row) => {
        const mxid = personIdToMatrixUserId[row.person.id]?.trim();
        return mxid ? [mxid] : [];
      });
      rememberGroupChatMembers(roomId, memberIds);
      await ensureRoomMembers(roomId, memberIds);
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
    const openChat = openChatRef.current;
    if (!openChat) {
      setNotice(tChat('matrixUnavailable'));
      return;
    }
    await openChat({
      id: card.person.id,
      slug: card.person.slug,
      name: card.person.name,
      surname: card.person.surname,
      nickname: card.person.nickname,
      avatarUrl: card.person.avatarUrl,
    });
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

      {section === 'messages' || section === 'archived' ? (
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
              {section === 'archived' ? null : picking ? (
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

          {debugRooms ? (
            <div
              className="overflow-x-auto border border-border bg-muted/30 p-3 text-[11px] leading-4 text-muted-foreground"
              data-testid="debug-rooms"
            >
              <p className="mb-2 font-medium text-foreground">
                debugRooms ({roomDiagnostics.length})
              </p>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1 pr-2">reason</th>
                    <th className="py-1 pr-2">cache</th>
                    <th className="py-1 pr-2">membership</th>
                    <th className="py-1 pr-2">type</th>
                    <th className="py-1 pr-2">members</th>
                    <th className="py-1 pr-2">name</th>
                    <th className="py-1">roomId</th>
                  </tr>
                </thead>
                <tbody>
                  {roomDiagnostics.map((room) => (
                    <tr key={room.roomId} className="border-b border-border/60">
                      <td className="py-1 pr-2 whitespace-nowrap">
                        {room.reason}
                      </td>
                      <td className="py-1 pr-2">
                        {room.cached ? 'row' : 'missing'}
                      </td>
                      <td className="py-1 pr-2">{room.membership}</td>
                      <td className="py-1 pr-2">{room.roomType || '—'}</td>
                      <td className="py-1 pr-2 whitespace-nowrap">
                        {room.loadedHumanCount}/{room.summaryJoinedCount} o
                        {room.othersCount}
                        {room.archived ? ' archived' : ''}
                      </td>
                      <td className="py-1 pr-2">{room.name || '—'}</td>
                      <td className="py-1 break-all">{room.roomId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!isMatrixAvailable && !notice ? (
            <p className="text-2 text-muted-foreground">
              {isConnecting ? t('loading') : tChat('matrixUnavailable')}
            </p>
          ) : null}

          {section === 'archived' &&
          isMatrixAvailable &&
          people.length === 0 &&
          !searching ? (
            <p className="text-2 text-muted-foreground">
              {needle ? t('noMatches') : t('archivedEmpty')}
            </p>
          ) : null}

          {section !== 'archived' &&
          isMatrixAvailable &&
          home != null &&
          people.length === 0 &&
          !searching ? (
            <p className="text-2 text-muted-foreground">
              {needle ? t('noMatches') : t('empty')}
            </p>
          ) : null}

          {people.length > 0 ? (
            <MemberList
              title={section === 'archived' ? t('tabs.archived') : t('people')}
              rows={people}
              presenceById={presenceById}
              locale={locale}
              justNow={t('justNow')}
              noMessage={t('noMessage')}
              previewLoading={
                !synced || rowsPending || matrixIdsLoading || peopleBySubLoading
              }
              loadingLabel={t('loading')}
              youLabel={(message) => t('youWrote', { message })}
              unreadLabel={(count) => t('unread', { count })}
              selectLabel={(name) => t('selectMember', { name })}
              picking={picking}
              selected={selected}
              onOpen={(row) => void openMember(row)}
            />
          ) : null}

          {hasMorePeople && !needle && section !== 'archived' ? (
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
  previewLoading,
  loadingLabel,
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
  /** Rooms are still loading, so a missing conversation is not yet "empty". */
  previewLoading: boolean;
  loadingLabel: string;
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
          const leftoverPrivy = /privy_did_privy/i.test(row.preview);
          const previewText = leftoverPrivy ? '' : row.preview;
          const loadingPreview =
            leftoverPrivy || (previewLoading && (!row.roomId || !previewText));
          const preview = previewText
            ? row.mine
              ? youLabel(previewText)
              : previewText
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
                    {loadingPreview ? (
                      <span
                        role="status"
                        aria-busy="true"
                        aria-label={loadingLabel}
                        className="my-0.5 block h-3 w-40 max-w-full animate-pulse rounded-sm bg-neutral-5"
                      />
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-1 text-muted-foreground">
                        {preview}
                      </span>
                    )}
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
