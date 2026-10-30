'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import useSWR from 'swr';
import {
  RoomEvent,
  RoomStateEvent,
  type MatrixEvent,
  type Room,
  type RoomMember,
  type RoomState,
} from 'matrix-js-sdk';
import {
  firstLineForReplyPreview,
  Message,
  stripMatrixReplyFallback,
  useJwt,
  useMatrix,
  useMatrixUserIdsByPersonIds,
  useMe,
  useSpaceBySlug,
  type HyphaRoomType,
  type Person,
} from '@hypha-platform/core/client';
import type { MatrixClient } from 'matrix-js-sdk';

import {
  HumanChatPanelChatBar,
  HumanChatPanelMessages,
  type ChatMentionCandidate,
} from './human-chat-panel';
import {
  inviteMatrixAgentIfNeeded,
  requestMatrixAgentReply,
  withMatrixAgentMention,
  type MatrixAgentRoomContext,
  type MatrixAgentSkill,
} from './human-chat-panel/matrix-agent-mention';
import {
  isHyphaBotMatrixIdentity,
  matrixMemberDisplayLabel,
  matrixMemberDisplayLabelFromRoom,
  shortenMatrixIdForDisplay,
} from './human-chat-panel/matrix-room-member-display';
import {
  sanitizeMentionDisplayLabel,
  wireComposerPlainForMatrixSend,
} from './human-chat-panel/human-chat-display-mention';
import { buildSpaceRosterMentionCandidates } from './human-chat-panel/build-space-roster-mention-candidates';
import { resolveSpaceDisplayLogoUrl } from '../spaces/utils/resolve-space-display-logo-url';

async function loadSpaceMembers(
  spaceSlug: string,
  authToken: string | null,
): Promise<Person[]> {
  const headers: HeadersInit = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const people: Person[] = [];
  const pageSize = 100;
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetch(
      `/api/v1/spaces/${encodeURIComponent(
        spaceSlug,
      )}/members?page=${page}&pageSize=${pageSize}`,
      { headers },
    );
    if (!response.ok) break;
    const body = (await response.json()) as {
      persons?: {
        data?: Person[];
        pagination?: { pageCount?: number };
      };
    };
    const batch = body.persons?.data ?? [];
    people.push(...batch);
    const pageCount = body.persons?.pagination?.pageCount;
    if (batch.length < pageSize) break;
    if (pageCount != null && page >= pageCount) break;
  }
  return people;
}

function matrixMemberAvatarSquare(
  client: MatrixClient | null | undefined,
  roomId: string | null | undefined,
  userId: string | undefined,
  px: number,
): string | undefined {
  if (!client || !roomId || !userId) return undefined;
  const room = client.getRoom(roomId);
  const member = room?.getMember(userId);
  if (!member) return undefined;
  const mxc = member.getMxcAvatarUrl();
  if (!mxc || !mxc.startsWith('mxc://')) return undefined;
  return (
    client.mxcUrlToHttp(mxc, px, px, 'crop', true, false, false) ?? undefined
  );
}

type PanelMessage = {
  id: string;
  role: 'user' | 'member';
  parts?: Array<
    { type: 'text'; text: string } | { type: string; [k: string]: unknown }
  >;
  senderName?: string;
  senderMatrixId?: string;
  agentSpecialistId?: string;
  avatarUrl?: string;
  timestamp?: Date;
  formattedContentHtml?: string;
  reactions?: Array<{
    emoji: string;
    count: number;
    includesCurrentUser?: boolean;
    reactorUserIds?: string[];
  }>;
  replyTo?: {
    authorLabel: string;
    excerpt?: string;
    sourceUserId?: string;
    authorAvatarUrl?: string;
  };
  mentionedUserIds?: string[];
};

type ReplyDraft = {
  messageId: string;
  authorLabel: string;
  excerpt: string;
  sourceUserId?: string;
  isYou?: boolean;
};

type EditDraft = {
  messageId: string;
  excerpt: string;
};

function computeDuplicateSanitizedDisplayKeys(
  mentionLabelByUserId: ReadonlyMap<string, string>,
): Set<string> {
  const counts = new Map<string, number>();
  for (const label of mentionLabelByUserId.values()) {
    const key = sanitizeMentionDisplayLabel(label);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicateKeys = new Set<string>();
  for (const [key, count] of counts) {
    if (count > 1) duplicateKeys.add(key);
  }
  return duplicateKeys;
}

function disambiguatedMentionTokenKey(
  userId: string,
  displayLabel: string,
  duplicateKeys: ReadonlySet<string>,
): string {
  let key = sanitizeMentionDisplayLabel(displayLabel);
  if (!key) return '';
  if (!duplicateKeys.has(key)) return key;
  const stem = shortenMatrixIdForDisplay(userId).replace(/^@/, '').trim();
  const short =
    stem.length <= 26 ? stem : `${stem.slice(0, 12)}...${stem.slice(-8)}`;
  const stableSuffix = userId.replace(/^@/, '').trim().slice(-10);
  key = sanitizeMentionDisplayLabel(
    `${displayLabel} (${short}-${stableSuffix})`,
  );
  if (!key) return sanitizeMentionDisplayLabel(userId);
  return key;
}

function plainFromPanelMessage(message: PanelMessage): string {
  const textParts =
    message.parts?.filter(
      (part): part is { type: 'text'; text: string } => part.type === 'text',
    ) ?? [];
  return textParts.map((part) => part.text).join('');
}

export type MatrixDiscussionAgent = {
  /** Name members @mention; also the label of the agent's replies. */
  label: string;
  skills: readonly MatrixAgentSkill[];
};

export type MatrixDiscussionComposerTools = {
  /** Add text to the end of the composer, on its own paragraph. */
  appendToComposer: (text: string) => void;
  /** Start the composer with an @mention of the agent. */
  mentionAgent: () => void;
  composerLocked: boolean;
};

export type MatrixDiscussionThreadProps = {
  /** Identity of the discussed entity. The live room resets when it changes. */
  threadKey: string;
  initialChatRoomId?: string | null;
  /** False while the owner is still loading, so a missing room id is not "none". */
  chatRoomResolved?: boolean;
  roomTitle: string;
  roomType: HyphaRoomType;
  /**
   * Store the room on its owner. Resolve with the room id the owner keeps (it
   * may be another member's room), or null when it could not be stored yet.
   */
  persistRoomId: (roomId: string) => Promise<string | null>;
  spaceSlug?: string;
  agent: MatrixDiscussionAgent;
  agentContext: Omit<MatrixAgentRoomContext, 'spaceSlug'>;
  /** A message from the agent arrived in the room. */
  onAgentMessage?: () => void;
  placeholder: string;
  connectingLabel: string;
  unavailableLabel: string;
  /** Prefix for console warnings. */
  logLabel: string;
  messagesClassName?: string;
  /** Shown above the composer while the room has no messages. */
  emptyHint?: React.ReactNode;
  renderComposerTools?: (
    tools: MatrixDiscussionComposerTools,
  ) => React.ReactNode;
};

/**
 * Matrix discussion attached to one entity (a proposal, a Context section, …):
 * one room per entity, created lazily, every space member invited. AI Agents
 * answer only when a member @mentions them.
 */
export function MatrixDiscussionThread({
  threadKey,
  initialChatRoomId,
  chatRoomResolved = false,
  roomTitle,
  roomType,
  persistRoomId,
  spaceSlug,
  agent,
  agentContext,
  onAgentMessage,
  placeholder,
  connectingLabel,
  unavailableLabel,
  logLabel,
  messagesClassName,
  emptyHint,
  renderComposerTools,
}: MatrixDiscussionThreadProps) {
  const tChat = useTranslations('HumanChatPanel');
  const { jwt: authToken } = useJwt();
  const { person: me } = useMe();
  const { resolvedTheme } = useTheme();
  const { space } = useSpaceBySlug(spaceSlug ?? '');
  const currentUserAvatarUrl = me?.avatarUrl?.trim() || undefined;
  const agentAvatarUrl = resolveSpaceDisplayLogoUrl(
    space,
    resolvedTheme === 'dark' ? 'dark' : 'light',
  );
  const {
    client,
    createRoom,
    joinRoom,
    getRoomMessages,
    loadRoomHistory,
    getRoomMembers,
    registerRoomListener,
    unregisterRoomListener,
    sendMessage: sendMatrixMessage,
    ensureRoomMembers,
    editRoomMessage,
    redactRoomEvent,
    toggleReaction,
  } = useMatrix();

  const [roomId, setRoomId] = React.useState<string | null>(
    initialChatRoomId?.trim() || null,
  );
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [replyDraft, setReplyDraft] = React.useState<ReplyDraft | null>(null);
  const [scrollToEventId, setScrollToEventId] = React.useState<string | null>(
    null,
  );
  const [editDraft, setEditDraft] = React.useState<EditDraft | null>(null);
  const [mentionMembershipEpoch, setMentionMembershipEpoch] = React.useState(0);
  const [provisionError, setProvisionError] = React.useState<string | null>(
    null,
  );
  const [composerError, setComposerError] = React.useState<string | null>(null);

  const refreshRoomMessages = React.useCallback((targetRoomId: string) => {
    const refreshed = getRoomMessagesRef.current(targetRoomId);
    if (refreshed) setMessages(refreshed);
  }, []);

  const registeredRoomIdRef = React.useRef<string | null>(null);
  const pendingRoomRef = React.useRef<Promise<string | null> | null>(null);
  const backfillTokenRef = React.useRef(0);
  const roomIdRef = React.useRef(roomId);
  roomIdRef.current = roomId;
  const roomTitleRef = React.useRef(roomTitle);
  roomTitleRef.current = roomTitle;
  const roomTypeRef = React.useRef(roomType);
  roomTypeRef.current = roomType;
  const unavailableLabelRef = React.useRef(unavailableLabel);
  unavailableLabelRef.current = unavailableLabel;
  const logLabelRef = React.useRef(logLabel);
  logLabelRef.current = logLabel;
  const onAgentMessageRef = React.useRef(onAgentMessage);
  onAgentMessageRef.current = onAgentMessage;
  const createRoomRef = React.useRef(createRoom);
  createRoomRef.current = createRoom;
  const joinRoomRef = React.useRef(joinRoom);
  joinRoomRef.current = joinRoom;
  const getRoomMessagesRef = React.useRef(getRoomMessages);
  getRoomMessagesRef.current = getRoomMessages;
  const loadRoomHistoryRef = React.useRef(loadRoomHistory);
  loadRoomHistoryRef.current = loadRoomHistory;
  const persistedRoomRef = React.useRef(initialChatRoomId?.trim() || null);
  const chatRoomResolvedRef = React.useRef(chatRoomResolved);
  chatRoomResolvedRef.current = chatRoomResolved;
  const storedRoomIdRef = React.useRef(initialChatRoomId?.trim() || null);
  storedRoomIdRef.current = initialChatRoomId?.trim() || null;
  const getRoomMembersRef = React.useRef(getRoomMembers);
  getRoomMembersRef.current = getRoomMembers;
  const registerRoomListenerRef = React.useRef(registerRoomListener);
  registerRoomListenerRef.current = registerRoomListener;
  const unregisterRoomListenerRef = React.useRef(unregisterRoomListener);
  unregisterRoomListenerRef.current = unregisterRoomListener;
  /** Room we already joined and hydrated — avoids tearing the timeline down on alias remap. */
  const hydratedRoomIdRef = React.useRef<string | null>(null);
  const clientRef = React.useRef(client);
  clientRef.current = client;

  const currentUserId = client?.getUserId() ?? null;
  const agentLabel = agent.label;
  const memberSpaceSlug = spaceSlug?.trim() || '';
  const { data: spaceMembers = [] } = useSWR(
    memberSpaceSlug
      ? ['discussion-chat-members', memberSpaceSlug, authToken ?? null]
      : null,
    () => loadSpaceMembers(memberSpaceSlug, authToken ?? null),
  );
  const rosterPersonIds = React.useMemo(
    () =>
      spaceMembers
        .map((member) => member.id)
        .filter((id): id is number => Number.isFinite(id) && id > 0),
    [spaceMembers],
  );
  const { personIdToMatrixUserId } = useMatrixUserIdsByPersonIds({
    personIds: rosterPersonIds,
  });
  const memberMatrixIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const matrixUserId of Object.values(personIdToMatrixUserId)) {
      const id = matrixUserId?.trim();
      if (id) ids.add(id);
    }
    return [...ids].sort();
  }, [personIdToMatrixUserId]);
  const invitedMembersKeyRef = React.useRef('');

  const resolveMemberLabel = React.useCallback(
    (userId: string | undefined) => {
      if (!userId) return tChat('unknownMember');
      if (isHyphaBotMatrixIdentity(userId)) return agentLabel;
      return matrixMemberDisplayLabelFromRoom(
        clientRef.current ?? null,
        roomIdRef.current,
        userId,
      );
    },
    [agentLabel, tChat],
  );

  const resolveMemberAvatar = React.useCallback(
    (userId: string | undefined) => {
      if (!userId) return undefined;
      if (currentUserId && userId === currentUserId) {
        return currentUserAvatarUrl;
      }
      if (isHyphaBotMatrixIdentity(userId)) {
        return agentAvatarUrl || undefined;
      }
      return matrixMemberAvatarSquare(
        clientRef.current,
        roomIdRef.current,
        userId,
        96,
      );
    },
    [agentAvatarUrl, currentUserAvatarUrl, currentUserId],
  );

  const panelMessages = React.useMemo((): PanelMessage[] => {
    return messages.map((msg) => {
      const isCurrentUser = Boolean(
        currentUserId && msg.sender === currentUserId,
      );
      const replyAuthorId = msg.inReplyToSender;
      const avatarUrl = isCurrentUser
        ? currentUserAvatarUrl
        : resolveMemberAvatar(msg.sender);
      const replyAuthorAvatar = replyAuthorId
        ? currentUserId && replyAuthorId === currentUserId
          ? currentUserAvatarUrl
          : resolveMemberAvatar(replyAuthorId)
        : undefined;
      return {
        id: msg.id,
        role: isCurrentUser ? 'user' : 'member',
        parts: [{ type: 'text', text: msg.content }],
        senderName: isCurrentUser ? undefined : resolveMemberLabel(msg.sender),
        senderMatrixId: msg.sender,
        ...(msg.agentSpecialistId
          ? { agentSpecialistId: msg.agentSpecialistId }
          : {}),
        ...(avatarUrl ? { avatarUrl } : {}),
        timestamp: msg.timestamp,
        formattedContentHtml: msg.formattedContentHtml,
        reactions: msg.reactions?.map((reaction) => ({
          emoji: reaction.key,
          count: reaction.count,
          includesCurrentUser: reaction.includesCurrentUser,
          reactorUserIds: reaction.reactorUserIds,
        })),
        ...(msg.inReplyToEventId
          ? {
              replyTo: {
                eventId: msg.inReplyToEventId,
                authorLabel: resolveMemberLabel(replyAuthorId),
                excerpt: msg.inReplyToBodyPreview,
                sourceUserId: replyAuthorId,
                ...(replyAuthorAvatar
                  ? { authorAvatarUrl: replyAuthorAvatar }
                  : {}),
              },
            }
          : {}),
        ...(msg.mentionedUserIds?.length
          ? { mentionedUserIds: msg.mentionedUserIds }
          : {}),
      };
    });
  }, [
    currentUserAvatarUrl,
    currentUserId,
    messages,
    resolveMemberAvatar,
    resolveMemberLabel,
  ]);

  const ensureRoom = React.useCallback(async (): Promise<string | null> => {
    if (roomIdRef.current) return roomIdRef.current;
    if (pendingRoomRef.current) return pendingRoomRef.current;
    const task = (async () => {
      let provisioning = false;
      try {
        // A missing id before the owner arrives means "still loading", not
        // "this entity has no room". Creating one here would replace the thread.
        for (
          let attempt = 0;
          attempt < 40 && !chatRoomResolvedRef.current;
          attempt += 1
        ) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        const stored = storedRoomIdRef.current;
        if (stored) {
          roomIdRef.current = stored;
          setRoomId(stored);
          return stored;
        }
        if (!chatRoomResolvedRef.current) return null;
        setProvisionError(null);
        provisioning = true;
        setIsLoading(true);
        const created = await createRoomRef.current(roomTitleRef.current, {
          grantCreatorPl100: true,
          roomType: roomTypeRef.current,
        });
        const canonicalId = await joinRoomRef.current(created.roomId);
        roomIdRef.current = canonicalId;
        setRoomId(canonicalId);
        return canonicalId;
      } catch (error) {
        console.warn(
          `[${logLabelRef.current}] room provisioning failed`,
          error,
        );
        setProvisionError(unavailableLabelRef.current);
        return null;
      } finally {
        if (provisioning) setIsLoading(false);
        pendingRoomRef.current = null;
      }
    })();
    pendingRoomRef.current = task;
    return task;
  }, [threadKey]);

  React.useEffect(() => {
    const next = initialChatRoomId?.trim() || null;
    if (!next) return;
    persistedRoomRef.current = next;
    if (next !== roomIdRef.current) {
      roomIdRef.current = next;
      setRoomId(next);
    }
  }, [initialChatRoomId]);

  // Keep the room id on its owner so a later visit opens the same thread.
  React.useEffect(() => {
    if (!chatRoomResolved || !roomId) return;
    const stored = storedRoomIdRef.current;
    if (stored && stored !== roomId) return;
    if (persistedRoomRef.current === roomId) return;
    let cancelled = false;
    void persistRoomId(roomId)
      .then((kept) => {
        if (cancelled || !kept) return;
        persistedRoomRef.current = kept;
        if (kept !== roomIdRef.current) {
          roomIdRef.current = kept;
          setRoomId(kept);
        }
      })
      .catch((error) => {
        console.warn(
          `[${logLabelRef.current}] failed to store the room`,
          error,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [chatRoomResolved, persistRoomId, roomId]);

  // Lazily create + persist a Matrix room when the owner has none yet.
  React.useEffect(() => {
    if (!chatRoomResolved || !threadKey || roomId) return;
    if (storedRoomIdRef.current) return;
    void ensureRoom();
  }, [chatRoomResolved, ensureRoom, roomId, threadKey]);

  // Drop the live room when the discussed entity itself changes.
  React.useEffect(() => {
    return () => {
      const id = registeredRoomIdRef.current;
      if (id) unregisterRoomListenerRef.current(id);
      registeredRoomIdRef.current = null;
      hydratedRoomIdRef.current = null;
      backfillTokenRef.current += 1;
    };
  }, [threadKey]);

  // Join, hydrate timeline, and listen for new messages.
  React.useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    const register = async (roomIdOrAlias: string) => {
      let canonicalId = roomIdOrAlias;
      try {
        canonicalId = await joinRoomRef.current(roomIdOrAlias);
        if (cancelled) return;

        roomIdRef.current = canonicalId;

        // Already listening on this room — alias remap must not reload history.
        if (hydratedRoomIdRef.current === canonicalId) {
          if (canonicalId !== roomIdOrAlias) setRoomId(canonicalId);
          return;
        }

        // Switching to a different room on the same thread instance.
        if (
          registeredRoomIdRef.current &&
          registeredRoomIdRef.current !== canonicalId
        ) {
          unregisterRoomListenerRef.current(registeredRoomIdRef.current);
          setMessages([]);
        }

        setIsLoading(true);
        registeredRoomIdRef.current = canonicalId;

        registerRoomListenerRef.current(
          canonicalId,
          async (message: Message) => {
            setMessages((prev) => {
              if (message.redacted) {
                return prev.filter((item) => item.id !== message.id);
              }
              const index = prev.findIndex((item) => item.id === message.id);
              if (index >= 0) {
                const next = [...prev];
                next[index] = message;
                return next;
              }
              return [...prev, message];
            });
            if (!message.redacted && isHyphaBotMatrixIdentity(message.sender)) {
              onAgentMessageRef.current?.();
            }
            await getRoomMembersRef.current(canonicalId);
          },
          async (pinned: string[]) => {
            setMessages((prev) =>
              prev.map((message) => ({
                ...message,
                pinned: pinned.includes(message.id),
              })),
            );
          },
        );

        const readHistory = async (force: boolean) => {
          try {
            await loadRoomHistoryRef.current(canonicalId, {
              pageSize: 50,
              maxBatches: 4,
              force,
            });
          } catch (error) {
            console.warn(`[${logLabelRef.current}] history load failed`, error);
          }
          if (cancelled) return null;
          return getRoomMessagesRef.current(canonicalId);
        };
        let msgs = await readHistory(false);
        // A room joined a moment ago can still have an empty timeline until
        // sync lands. One more pass before treating the thread as empty.
        if (!cancelled && (!msgs || msgs.length === 0)) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          if (!cancelled) msgs = await readHistory(true);
        }
        if (cancelled || !msgs) return;
        const loaded = msgs;
        if (loaded.length > 0) {
          setMessages(loaded);
        } else {
          setMessages((prev) => (prev.length > 0 ? prev : loaded));
        }
        hydratedRoomIdRef.current = canonicalId;
        await getRoomMembersRef.current(canonicalId);
        if (canonicalId !== roomIdOrAlias) setRoomId(canonicalId);
      } catch (error) {
        console.warn(`[${logLabelRef.current}] join failed`, error);
        if (registeredRoomIdRef.current === canonicalId) {
          unregisterRoomListenerRef.current(canonicalId);
          registeredRoomIdRef.current = null;
          hydratedRoomIdRef.current = null;
        }
        if (!cancelled) {
          setProvisionError(unavailableLabelRef.current);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void register(roomId);
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  React.useEffect(() => {
    if (!client || !roomId) return;
    const room = client.getRoom(roomId);
    if (!room) return;
    const bumpMembership = (
      _event: MatrixEvent,
      state: RoomState,
      _member: RoomMember,
    ) => {
      if (state?.roomId !== roomId) return;
      setMentionMembershipEpoch((n) => n + 1);
    };
    const onLocalEchoUpdated = (
      ev: MatrixEvent,
      _r: Room,
      oldEventId?: string,
    ) => {
      if (!oldEventId) return;
      const newId = ev.getId();
      if (!newId || oldEventId === newId) return;
      setMessages((prev) =>
        prev.map((message) =>
          message.id === oldEventId ? { ...message, id: newId } : message,
        ),
      );
      setReplyDraft((draft) =>
        draft?.messageId === oldEventId
          ? { ...draft, messageId: newId }
          : draft,
      );
      setEditDraft((draft) =>
        draft?.messageId === oldEventId
          ? { ...draft, messageId: newId }
          : draft,
      );
    };
    client.on(RoomStateEvent.Members, bumpMembership);
    client.on(RoomStateEvent.NewMember, bumpMembership);
    room.on(RoomEvent.LocalEchoUpdated, onLocalEchoUpdated);
    return () => {
      client.off(RoomStateEvent.Members, bumpMembership);
      client.off(RoomStateEvent.NewMember, bumpMembership);
      room.off(RoomEvent.LocalEchoUpdated, onLocalEchoUpdated);
    };
  }, [client, roomId]);

  const mentionCandidates = React.useMemo((): ChatMentionCandidate[] => {
    const joined: ChatMentionCandidate[] = [];
    const room = client && roomId ? client.getRoom(roomId) : null;
    if (room) {
      for (const member of room.getJoinedMembers()) {
        const userId = member.userId;
        if (!userId) continue;
        if (currentUserId && userId === currentUserId) continue;
        joined.push({
          userId,
          displayLabel: matrixMemberDisplayLabel(member, userId),
        });
      }
    }
    const roster = buildSpaceRosterMentionCandidates({
      spaceMembers,
      personIdToMatrixUserId,
      unknownLabel: tChat('unknownMember'),
      extraCandidates: joined,
    }).filter((candidate) => candidate.userId !== currentUserId);
    const logoUrl = resolveSpaceDisplayLogoUrl(
      space,
      resolvedTheme === 'dark' ? 'dark' : 'light',
    );
    return withMatrixAgentMention(roster, agentLabel, agent.skills, {
      kind: 'space',
      logoUrl,
    });
  }, [
    agent.skills,
    agentLabel,
    client,
    currentUserId,
    mentionMembershipEpoch,
    personIdToMatrixUserId,
    resolvedTheme,
    roomId,
    space,
    spaceMembers,
    tChat,
  ]);

  React.useEffect(() => {
    if (!roomId || memberMatrixIds.length === 0) return;
    const key = `${roomId}:${memberMatrixIds.join(',')}`;
    if (invitedMembersKeyRef.current === key) return;
    invitedMembersKeyRef.current = key;
    void ensureRoomMembers(roomId, memberMatrixIds);
  }, [ensureRoomMembers, roomId, memberMatrixIds]);

  const mentionLabelByUserId = React.useMemo(
    () =>
      new Map(
        mentionCandidates.map((candidate) => [
          candidate.userId,
          candidate.displayLabel,
        ]),
      ),
    [mentionCandidates],
  );

  const duplicateSanitizedDisplayKeys = React.useMemo(
    () => computeDuplicateSanitizedDisplayKeys(mentionLabelByUserId),
    [mentionLabelByUserId],
  );

  const mentionSanitizedLabelToUserId = React.useMemo(() => {
    const mapped = new Map<string, string>();
    for (const [userId, label] of mentionLabelByUserId) {
      const key = disambiguatedMentionTokenKey(
        userId,
        label,
        duplicateSanitizedDisplayKeys,
      );
      if (!key) continue;
      mapped.set(key, userId);
    }
    return mapped;
  }, [duplicateSanitizedDisplayKeys, mentionLabelByUserId]);

  const getMentionComposerLabel = React.useCallback(
    (member: ChatMentionCandidate, resolvedComposerLabel?: string) => {
      const label = resolvedComposerLabel?.trim() || member.displayLabel;
      const effectiveLabels = new Map(mentionLabelByUserId);
      effectiveLabels.set(member.userId, label);
      const duplicatesForPick =
        computeDuplicateSanitizedDisplayKeys(effectiveLabels);
      return (
        disambiguatedMentionTokenKey(member.userId, label, duplicatesForPick) ||
        label
      );
    },
    [mentionLabelByUserId],
  );

  const handleReplyToMessage = React.useCallback(
    (messageId: string) => {
      const target = panelMessages.find((message) => message.id === messageId);
      if (!target) return;
      const authorLabel =
        target.role === 'user'
          ? tChat('you')
          : isHyphaBotMatrixIdentity(target.senderMatrixId, target.senderName)
          ? agentLabel
          : target.senderName ?? resolveMemberLabel(target.senderMatrixId);
      setEditDraft(null);
      setReplyDraft({
        messageId,
        authorLabel,
        excerpt: firstLineForReplyPreview(plainFromPanelMessage(target)),
        ...(target.role === 'user' ? { isYou: true } : {}),
        ...(target.senderMatrixId
          ? { sourceUserId: target.senderMatrixId }
          : {}),
      });
    },
    [agentLabel, panelMessages, resolveMemberLabel, tChat],
  );

  const handleEditMessage = React.useCallback(
    (messageId: string) => {
      const target = panelMessages.find((message) => message.id === messageId);
      if (!target || target.role !== 'user') return;
      const plain = stripMatrixReplyFallback(plainFromPanelMessage(target));
      setReplyDraft(null);
      setEditDraft({
        messageId,
        excerpt: firstLineForReplyPreview(plain),
      });
      setInput(plain);
    },
    [panelMessages],
  );

  const handleDeleteMessage = React.useCallback(
    async (messageId: string) => {
      if (!roomId) return;
      setComposerError(null);
      try {
        await redactRoomEvent({ roomId, eventId: messageId });
        setMessages((prev) =>
          prev.filter((message) => message.id !== messageId),
        );
        refreshRoomMessages(roomId);
        if (editDraft?.messageId === messageId) {
          setEditDraft(null);
          setInput('');
        }
        if (replyDraft?.messageId === messageId) {
          setReplyDraft(null);
        }
      } catch (error) {
        console.warn(`[${logLabelRef.current}] delete failed`, error);
        setComposerError(tChat('messageDeleteFailed'));
        throw error;
      }
    },
    [
      editDraft?.messageId,
      redactRoomEvent,
      refreshRoomMessages,
      replyDraft?.messageId,
      roomId,
      tChat,
    ],
  );

  const handleToggleReaction = React.useCallback(
    async (messageId: string, emoji: string) => {
      if (!roomId) return;
      setComposerError(null);
      try {
        await toggleReaction({
          roomId,
          targetEventId: messageId,
          key: emoji,
        });
        refreshRoomMessages(roomId);
      } catch (error) {
        console.warn(`[${logLabelRef.current}] reaction failed`, error);
        setComposerError(tChat('reactionToggleFailed'));
      }
    },
    [refreshRoomMessages, roomId, tChat, toggleReaction],
  );

  const sendMessage = React.useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const targetRoom = roomIdRef.current ?? roomId ?? (await ensureRoom());
    if (!targetRoom) return;
    const replyToEventId = replyDraft?.messageId;
    const editTargetEventId = editDraft?.messageId;
    const savedReply = replyDraft;
    const savedEdit = editDraft;
    const savedInput = input;
    setComposerError(null);
    try {
      const { wirePlain, mentionUserIds } = wireComposerPlainForMatrixSend(
        input,
        mentionSanitizedLabelToUserId,
      );
      if (editTargetEventId) {
        await editRoomMessage({
          roomId: targetRoom,
          targetEventId: editTargetEventId,
          message: wirePlain,
          mentionUserIds,
        });
      } else {
        await sendMatrixMessage({
          roomId: targetRoom,
          message: wirePlain,
          mentionUserIds,
          ...(replyToEventId ? { replyToEventId } : {}),
        });
        if (mentionUserIds.length > 0) {
          void ensureRoomMembers(targetRoom, mentionUserIds);
        }
        await inviteMatrixAgentIfNeeded(client, targetRoom, mentionUserIds);
        requestMatrixAgentReply({
          authToken,
          roomId: targetRoom,
          mentionUserIds,
          context: { ...agentContext, spaceSlug },
        });
      }
      refreshRoomMessages(targetRoom);
      setInput('');
      setReplyDraft(null);
      setEditDraft(null);
    } catch (error) {
      console.warn(`[${logLabelRef.current}] send failed`, error);
      setInput(savedInput);
      setReplyDraft(savedReply);
      setEditDraft(savedEdit);
      setComposerError(tChat('sendFailed'));
    }
  }, [
    agentContext,
    authToken,
    client,
    ensureRoomMembers,
    editDraft,
    editRoomMessage,
    ensureRoom,
    input,
    mentionSanitizedLabelToUserId,
    refreshRoomMessages,
    replyDraft,
    roomId,
    sendMatrixMessage,
    spaceSlug,
    tChat,
  ]);

  const appendToComposer = React.useCallback((text: string) => {
    const addition = text.trim();
    if (!addition) return;
    setComposerError(null);
    setInput((current) =>
      current.trim() ? `${current.trimEnd()}\n\n${addition}` : addition,
    );
  }, []);

  const agentMentionToken = React.useMemo(() => {
    const agentRow = mentionCandidates.find((candidate) =>
      isHyphaBotMatrixIdentity(candidate.userId, candidate.displayLabel),
    );
    return agentRow ? `@${getMentionComposerLabel(agentRow)}` : null;
  }, [getMentionComposerLabel, mentionCandidates]);

  const mentionAgent = React.useCallback(() => {
    if (!agentMentionToken) return;
    setComposerError(null);
    setInput((current) => {
      if (current.includes(agentMentionToken)) return current;
      return current.trim()
        ? `${agentMentionToken} ${current.trimStart()}`
        : `${agentMentionToken} `;
    });
  }, [agentMentionToken]);

  if (provisionError) {
    return (
      <p className="text-1 text-error-11" role="alert">
        {provisionError}
      </p>
    );
  }

  return (
    <>
      <div className={messagesClassName ?? 'flex h-[22rem] min-h-0 flex-col'}>
        <HumanChatPanelMessages
          messages={panelMessages}
          roomId={roomId}
          currentUserId={currentUserId}
          currentUserAvatarUrl={currentUserAvatarUrl}
          onReply={handleReplyToMessage}
          onJumpToOriginalMessage={(eventId) => {
            const id = eventId.trim();
            if (!id) return;
            setScrollToEventId(null);
            requestAnimationFrame(() => setScrollToEventId(id));
          }}
          scrollTargetEventId={scrollToEventId}
          onConsumedScrollTarget={() => setScrollToEventId(null)}
          onScrollTargetNotFound={(eventId) => {
            const targetRoomId = roomId?.trim();
            if (!targetRoomId) {
              setScrollToEventId(null);
              return;
            }
            void (async () => {
              const token = backfillTokenRef.current;
              let hasMore = true;
              for (let attempt = 0; attempt < 12 && hasMore; attempt += 1) {
                let result;
                try {
                  result = await loadRoomHistoryRef.current(targetRoomId, {
                    force: true,
                    maxBatches: 3,
                  });
                } catch {
                  if (backfillTokenRef.current !== token) return;
                  setScrollToEventId(null);
                  return;
                }
                if (backfillTokenRef.current !== token) return;
                hasMore = result.hasMoreOlder;
                refreshRoomMessages(targetRoomId);
                // Wait for React to commit the refreshed rows before DOM lookup.
                await new Promise<void>((resolve) => {
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                  );
                });
                if (backfillTokenRef.current !== token) return;
                const escaped =
                  typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
                    ? CSS.escape(eventId)
                    : eventId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                if (
                  document.querySelector(
                    `[data-matrix-event-id="${escaped}"]`,
                  ) != null
                ) {
                  // Keep the target set so the child can consume/jump.
                  setScrollToEventId(eventId);
                  return;
                }
                if (!hasMore) break;
              }
              if (backfillTokenRef.current !== token) return;
              setScrollToEventId(null);
            })();
          }}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onToggleReaction={handleToggleReaction}
          resolveReactionReactorLabel={resolveMemberLabel}
          resolveMatrixMemberLabel={resolveMemberLabel}
          resolveSenderDisplayLabel={resolveMemberLabel}
        />
        {Boolean(roomId) && isLoading && panelMessages.length === 0 ? (
          <p className="px-1 py-3 text-1 text-neutral-11">{connectingLabel}</p>
        ) : null}
        {emptyHint && !isLoading && panelMessages.length === 0 ? (
          <div className="px-1 py-3">{emptyHint}</div>
        ) : null}
      </div>
      {composerError ? (
        <p className="text-1 text-error-11" role="alert">
          {composerError}
        </p>
      ) : null}
      <HumanChatPanelChatBar
        value={input}
        onChange={(next) => {
          setComposerError(null);
          setInput(next);
        }}
        onSend={sendMessage}
        placeholder={placeholder}
        mentionCandidates={mentionCandidates}
        mentionPickerEnabled={mentionCandidates.length > 0}
        getMentionComposerLabel={getMentionComposerLabel}
        composerLocked={false}
        composerLockedMessage={connectingLabel}
        replyPreview={
          replyDraft
            ? {
                authorLabel: replyDraft.authorLabel,
                excerpt: replyDraft.excerpt,
                sourceUserId: replyDraft.sourceUserId,
                isYou: replyDraft.isYou,
                onDismiss: () => setReplyDraft(null),
              }
            : undefined
        }
        editPreview={
          editDraft
            ? {
                excerpt: editDraft.excerpt,
                onDismiss: () => {
                  setEditDraft(null);
                  setInput('');
                  setComposerError(null);
                },
              }
            : undefined
        }
      />
      {renderComposerTools?.({
        appendToComposer,
        mentionAgent,
        composerLocked: false,
      })}
    </>
  );
}
