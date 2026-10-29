'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import useSWR, { mutate as mutateCache } from 'swr';
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
  HYPHA_ROOM_TYPES,
  Message,
  stripMatrixReplyFallback,
  useAgreementMutationsWeb2Rsc,
  useJwt,
  useMatrix,
  useMatrixUserIdsByPersonIds,
  useMe,
  useSpaceBySlug,
  type Person,
} from '@hypha-platform/core/client';
import { Separator } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import type { MatrixClient } from 'matrix-js-sdk';

import {
  HumanChatPanelChatBar,
  HumanChatPanelMessages,
  type ChatMentionCandidate,
} from '../../common/human-chat-panel';
import {
  inviteMatrixAgentIfNeeded,
  matrixAgentSkills,
  requestMatrixAgentReply,
  withMatrixAgentMention,
} from '../../common/human-chat-panel/matrix-agent-mention';
import {
  isHyphaBotMatrixIdentity,
  matrixMemberDisplayLabel,
  matrixMemberDisplayLabelFromRoom,
  shortenMatrixIdForDisplay,
} from '../../common/human-chat-panel/matrix-room-member-display';
import {
  sanitizeMentionDisplayLabel,
  wireComposerPlainForMatrixSend,
} from '../../common/human-chat-panel/human-chat-display-mention';
import { buildSpaceRosterMentionCandidates } from '../../common/human-chat-panel/build-space-roster-mention-candidates';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';

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

/**
 * In-context Matrix discussion under proposal content in the overlay.
 * Mirrors signal rooms: one Matrix room per document, created lazily.
 */
export function ProposalDiscussionChat({
  documentSlug,
  title,
  initialChatRoomId,
  chatRoomResolved = false,
  spaceSlug,
  className,
}: {
  documentSlug: string;
  title?: string;
  initialChatRoomId?: string | null;
  /** False while the document is still loading, so a missing room id is not "none". */
  chatRoomResolved?: boolean;
  spaceSlug?: string;
  className?: string;
}) {
  const t = useTranslations('ProposalDetails');
  const tChat = useTranslations('HumanChatPanel');
  const tCoherence = useTranslations('CoherenceTab');
  const { jwt: authToken } = useJwt();
  const { person: me } = useMe();
  const { resolvedTheme } = useTheme();
  const { space } = useSpaceBySlug(spaceSlug ?? '');
  const { updateAgreementBySlug } = useAgreementMutationsWeb2Rsc(authToken);
  const currentUserAvatarUrl = me?.avatarUrl?.trim() || undefined;
  const agentAvatarUrl = resolveSpaceDisplayLogoUrl(
    space,
    resolvedTheme === 'dark' ? 'dark' : 'light',
  );
  const {
    isMatrixAvailable,
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
  const roomIdRef = React.useRef(roomId);
  roomIdRef.current = roomId;
  const titleRef = React.useRef(title);
  titleRef.current = title;
  const createRoomRef = React.useRef(createRoom);
  createRoomRef.current = createRoom;
  const joinRoomRef = React.useRef(joinRoom);
  joinRoomRef.current = joinRoom;
  const tRef = React.useRef(t);
  tRef.current = t;
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
  const agentLabel = tChat('agentMentionLabel');
  const memberSpaceSlug = spaceSlug?.trim() || '';
  const { data: spaceMembers = [] } = useSWR(
    memberSpaceSlug
      ? ['proposal-chat-members', memberSpaceSlug, authToken ?? null]
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
  const voterMatrixIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const matrixUserId of Object.values(personIdToMatrixUserId)) {
      const id = matrixUserId?.trim();
      if (id) ids.add(id);
    }
    return [...ids].sort();
  }, [personIdToMatrixUserId]);
  const invitedVotersKeyRef = React.useRef('');

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
        // A missing id before the document arrives means "still loading", not
        // "this proposal has no room". Creating one here would replace the thread.
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
        const currentTitle = titleRef.current?.trim();
        const roomTitle = currentTitle
          ? tRef.current('discussion.roomTitle', { title: currentTitle })
          : tRef.current('discussion.roomTitleFallback');
        const created = await createRoomRef.current(roomTitle, {
          grantCreatorPl100: true,
          roomType: HYPHA_ROOM_TYPES.proposal,
        });
        const canonicalId = await joinRoomRef.current(created.roomId);
        roomIdRef.current = canonicalId;
        setRoomId(canonicalId);
        return canonicalId;
      } catch (error) {
        console.warn(
          '[ProposalDiscussionChat] room provisioning failed',
          error,
        );
        setProvisionError(tRef.current('discussion.unavailable'));
        return null;
      } finally {
        if (provisioning) setIsLoading(false);
        pendingRoomRef.current = null;
      }
    })();
    pendingRoomRef.current = task;
    return task;
  }, [documentSlug]);

  React.useEffect(() => {
    const next = initialChatRoomId?.trim() || null;
    if (!next) return;
    persistedRoomRef.current = next;
    if (next !== roomIdRef.current) {
      roomIdRef.current = next;
      setRoomId(next);
    }
  }, [initialChatRoomId]);

  // Keep the room id on the document so a later visit opens the same thread.
  React.useEffect(() => {
    if (!chatRoomResolved || !roomId || !authToken || !documentSlug) return;
    const stored = storedRoomIdRef.current;
    if (stored && stored !== roomId) return;
    if (persistedRoomRef.current === roomId) return;
    let cancelled = false;
    void updateAgreementBySlug({ slug: documentSlug, chatRoomId: roomId })
      .then(() => {
        if (cancelled) return;
        persistedRoomRef.current = roomId;
        void mutateCache([`/api/v1/documents/${documentSlug}/`]);
      })
      .catch((error) => {
        console.warn(
          '[ProposalDiscussionChat] failed to store the room',
          error,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [
    authToken,
    chatRoomResolved,
    documentSlug,
    roomId,
    updateAgreementBySlug,
  ]);

  // Lazily create + persist a Matrix room when the proposal has none yet.
  React.useEffect(() => {
    if (!chatRoomResolved || !isMatrixAvailable || !documentSlug || roomId) {
      return;
    }
    if (storedRoomIdRef.current) return;
    void ensureRoom();
  }, [chatRoomResolved, documentSlug, ensureRoom, isMatrixAvailable, roomId]);

  // Drop the live room when the proposal itself changes.
  React.useEffect(() => {
    return () => {
      const id = registeredRoomIdRef.current;
      if (id) unregisterRoomListenerRef.current(id);
      registeredRoomIdRef.current = null;
      hydratedRoomIdRef.current = null;
    };
  }, [documentSlug]);

  // Join, hydrate timeline, and listen for new messages.
  React.useEffect(() => {
    if (!isMatrixAvailable || !roomId) return;
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

        // Switching to a different room on the same proposal instance.
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
            console.warn('[ProposalDiscussionChat] history load failed', error);
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
        console.warn('[ProposalDiscussionChat] join failed', error);
        if (registeredRoomIdRef.current === canonicalId) {
          unregisterRoomListenerRef.current(canonicalId);
          registeredRoomIdRef.current = null;
          hydratedRoomIdRef.current = null;
        }
        if (!cancelled) {
          setProvisionError(tRef.current('discussion.unavailable'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void register(roomId);
    return () => {
      cancelled = true;
    };
  }, [isMatrixAvailable, roomId]);

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
    return withMatrixAgentMention(
      roster,
      agentLabel,
      matrixAgentSkills(tChat),
      {
        kind: 'space',
        logoUrl,
      },
    );
  }, [
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
    if (!roomId || voterMatrixIds.length === 0) return;
    const key = `${roomId}:${voterMatrixIds.join(',')}`;
    if (invitedVotersKeyRef.current === key) return;
    invitedVotersKeyRef.current = key;
    void ensureRoomMembers(roomId, voterMatrixIds);
  }, [ensureRoomMembers, roomId, voterMatrixIds]);

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
          ? tChat('agentMentionLabel')
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
    [panelMessages, resolveMemberLabel, tChat],
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
        console.warn('[ProposalDiscussionChat] delete failed', error);
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
        console.warn('[ProposalDiscussionChat] reaction failed', error);
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
          context: {
            kind: 'proposal',
            spaceSlug,
            documentSlug,
            documentTitle: title,
          },
        });
      }
      refreshRoomMessages(targetRoom);
      setInput('');
      setReplyDraft(null);
      setEditDraft(null);
    } catch (error) {
      console.warn('[ProposalDiscussionChat] send failed', error);
      setInput(savedInput);
      setReplyDraft(savedReply);
      setEditDraft(savedEdit);
      setComposerError(tChat('sendFailed'));
    }
  }, [
    authToken,
    client,
    ensureRoomMembers,
    documentSlug,
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
    title,
  ]);

  if (!isMatrixAvailable) {
    return (
      <section
        className={cn(
          'mt-6 border border-border bg-background-2/40 p-4',
          className,
        )}
      >
        <h3
          className="text-3"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('discussion.title')}
        </h3>
        <p className="mt-2 text-1 text-neutral-11">
          {t('discussion.signInHint')}
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'mt-6 flex flex-col gap-3 border border-border bg-background-2/40 p-4',
        className,
      )}
    >
      <h3
        className="text-3"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {t('discussion.title')}
      </h3>
      <p className="text-1 text-neutral-11">{t('discussion.subtitle')}</p>
      <Separator />
      {provisionError ? (
        <p className="text-1 text-error-11" role="alert">
          {provisionError}
        </p>
      ) : (
        <>
          <div className="flex h-[22rem] min-h-0 flex-col">
            <HumanChatPanelMessages
              messages={panelMessages}
              roomId={roomId}
              currentUserId={currentUserId}
              currentUserAvatarUrl={currentUserAvatarUrl}
              onReply={handleReplyToMessage}
              onJumpToOriginalMessage={(eventId) => {
                const id = eventId.trim();
                if (!id) return;
                setScrollToEventId(id);
              }}
              scrollTargetEventId={scrollToEventId}
              onConsumedScrollTarget={() => setScrollToEventId(null)}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onToggleReaction={handleToggleReaction}
              resolveReactionReactorLabel={resolveMemberLabel}
              resolveMatrixMemberLabel={resolveMemberLabel}
              resolveSenderDisplayLabel={resolveMemberLabel}
            />
            {Boolean(roomId) && isLoading && panelMessages.length === 0 ? (
              <p className="px-1 py-3 text-1 text-neutral-11">
                {t('discussion.connecting')}
              </p>
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
            placeholder={tCoherence('saySomething')}
            mentionCandidates={mentionCandidates}
            mentionPickerEnabled={mentionCandidates.length > 0}
            getMentionComposerLabel={getMentionComposerLabel}
            composerLocked={Boolean(provisionError)}
            composerLockedMessage={provisionError ?? t('discussion.connecting')}
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
        </>
      )}
    </section>
  );
}
