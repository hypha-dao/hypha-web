'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { mutate as mutateCache } from 'swr';
import {
  RoomStateEvent,
  type MatrixEvent,
  type RoomMember,
  type RoomState,
} from 'matrix-js-sdk';
import {
  firstLineForReplyPreview,
  Message,
  stripMatrixReplyFallback,
  useAgreementMutationsWeb2Rsc,
  useJwt,
  useMatrix,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { Separator } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

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
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';

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
  const { resolvedTheme } = useTheme();
  const { space } = useSpaceBySlug(spaceSlug ?? '');
  const { updateAgreementBySlug } = useAgreementMutationsWeb2Rsc(authToken);
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
  const [editDraft, setEditDraft] = React.useState<EditDraft | null>(null);
  const [mentionMembershipEpoch, setMentionMembershipEpoch] = React.useState(0);
  const [provisionError, setProvisionError] = React.useState<string | null>(
    null,
  );

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

  const panelMessages = React.useMemo((): PanelMessage[] => {
    return messages.map((msg) => {
      const isCurrentUser = Boolean(
        currentUserId && msg.sender === currentUserId,
      );
      const replyAuthorId = msg.inReplyToSender;
      return {
        id: msg.id,
        role: isCurrentUser ? 'user' : 'member',
        parts: [{ type: 'text', text: msg.content }],
        senderName: isCurrentUser ? undefined : resolveMemberLabel(msg.sender),
        senderMatrixId: msg.sender,
        ...(msg.agentSpecialistId
          ? { agentSpecialistId: msg.agentSpecialistId }
          : {}),
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
                authorLabel: resolveMemberLabel(replyAuthorId),
                excerpt: msg.inReplyToBodyPreview,
                sourceUserId: replyAuthorId,
              },
            }
          : {}),
        ...(msg.mentionedUserIds?.length
          ? { mentionedUserIds: msg.mentionedUserIds }
          : {}),
      };
    });
  }, [currentUserId, messages, resolveMemberLabel]);

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
    client.on(RoomStateEvent.Members, bumpMembership);
    client.on(RoomStateEvent.NewMember, bumpMembership);
    return () => {
      client.off(RoomStateEvent.Members, bumpMembership);
      client.off(RoomStateEvent.NewMember, bumpMembership);
    };
  }, [client, roomId]);

  const mentionCandidates = React.useMemo((): ChatMentionCandidate[] => {
    if (!client || !roomId) return [];
    const room = client.getRoom(roomId);
    if (!room) return [];
    const list: ChatMentionCandidate[] = [];
    for (const member of room.getJoinedMembers()) {
      const userId = member.userId;
      if (!userId) continue;
      if (currentUserId && userId === currentUserId) continue;
      list.push({
        userId,
        displayLabel: matrixMemberDisplayLabel(member, userId),
      });
    }
    list.sort((a, b) =>
      a.displayLabel.localeCompare(b.displayLabel, undefined, {
        sensitivity: 'base',
      }),
    );
    const logoUrl = resolveSpaceDisplayLogoUrl(
      space,
      resolvedTheme === 'dark' ? 'dark' : 'light',
    );
    return withMatrixAgentMention(list, agentLabel, matrixAgentSkills(tChat), {
      kind: 'space',
      logoUrl,
    });
  }, [
    agentLabel,
    client,
    currentUserId,
    mentionMembershipEpoch,
    resolvedTheme,
    roomId,
    space,
    tChat,
  ]);

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
      try {
        await redactRoomEvent({ roomId, eventId: messageId });
        setMessages((prev) =>
          prev.filter((message) => message.id !== messageId),
        );
        if (editDraft?.messageId === messageId) {
          setEditDraft(null);
          setInput('');
        }
        if (replyDraft?.messageId === messageId) {
          setReplyDraft(null);
        }
      } catch (error) {
        console.warn('[ProposalDiscussionChat] delete failed', error);
      }
    },
    [editDraft?.messageId, redactRoomEvent, replyDraft?.messageId, roomId],
  );

  const handleToggleReaction = React.useCallback(
    async (messageId: string, emoji: string) => {
      if (!roomId) return;
      try {
        await toggleReaction({
          roomId,
          targetEventId: messageId,
          key: emoji,
        });
        const refreshed = getRoomMessages(roomId);
        if (refreshed) setMessages(refreshed);
      } catch (error) {
        console.warn('[ProposalDiscussionChat] reaction failed', error);
      }
    },
    [getRoomMessages, roomId, toggleReaction],
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
      setInput('');
      setReplyDraft(null);
      setEditDraft(null);
    } catch (error) {
      console.warn('[ProposalDiscussionChat] send failed', error);
      setInput(savedInput);
      setReplyDraft(savedReply);
      setEditDraft(savedEdit);
    }
  }, [
    authToken,
    client,
    documentSlug,
    editDraft,
    editRoomMessage,
    ensureRoom,
    input,
    mentionSanitizedLabelToUserId,
    replyDraft,
    roomId,
    sendMatrixMessage,
    spaceSlug,
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
          <div className="flex h-[22rem] min-h-0 flex-col overflow-hidden">
            <HumanChatPanelMessages
              messages={panelMessages}
              roomId={roomId}
              currentUserId={currentUserId}
              onReply={handleReplyToMessage}
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
          <HumanChatPanelChatBar
            value={input}
            onChange={setInput}
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
