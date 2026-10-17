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
  Message,
  useAgreementMutationsWeb2Rsc,
  useJwt,
  useMatrix,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { Separator } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { ChatMessageContainer } from '../../coherence/components/chat-message.container';
import {
  HumanChatPanelChatBar,
  type ChatMentionCandidate,
} from '../../common/human-chat-panel';
import {
  inviteMatrixAgentIfNeeded,
  matrixAgentSkills,
  requestMatrixAgentReply,
  withMatrixAgentMention,
} from '../../common/human-chat-panel/matrix-agent-mention';
import {
  matrixMemberDisplayLabel,
  shortenMatrixIdForDisplay,
} from '../../common/human-chat-panel/matrix-room-member-display';
import {
  sanitizeMentionDisplayLabel,
  wireComposerPlainForMatrixSend,
} from '../../common/human-chat-panel/human-chat-display-mention';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';

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

/**
 * In-context Matrix discussion under proposal content in the overlay.
 * Mirrors signal rooms: one Matrix room per document, created lazily.
 */
export function ProposalDiscussionChat({
  documentSlug,
  title,
  initialChatRoomId,
  spaceSlug,
  className,
}: {
  documentSlug: string;
  title?: string;
  initialChatRoomId?: string | null;
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
    togglePinnedMessage,
    sendMessage: sendMatrixMessage,
  } = useMatrix();

  const [roomId, setRoomId] = React.useState<string | null>(
    initialChatRoomId?.trim() || null,
  );
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [input, setInput] = React.useState('');
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
  const getRoomMembersRef = React.useRef(getRoomMembers);
  getRoomMembersRef.current = getRoomMembers;
  const registerRoomListenerRef = React.useRef(registerRoomListener);
  registerRoomListenerRef.current = registerRoomListener;
  const unregisterRoomListenerRef = React.useRef(unregisterRoomListener);
  unregisterRoomListenerRef.current = unregisterRoomListener;
  const bottomId = React.useId();

  const ensureRoom = React.useCallback(async (): Promise<string | null> => {
    if (roomIdRef.current) return roomIdRef.current;
    if (pendingRoomRef.current) return pendingRoomRef.current;
    const task = (async () => {
      setProvisionError(null);
      setIsLoading(true);
      try {
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
        setIsLoading(false);
        pendingRoomRef.current = null;
      }
    })();
    pendingRoomRef.current = task;
    return task;
  }, [documentSlug]);

  React.useEffect(() => {
    const next = initialChatRoomId?.trim() || null;
    if (next) persistedRoomRef.current = next;
    if (next && next !== roomId) setRoomId(next);
  }, [initialChatRoomId, roomId]);

  // Keep the room id on the document so a later visit opens the same thread.
  React.useEffect(() => {
    if (!roomId || !authToken || !documentSlug) return;
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
  }, [authToken, documentSlug, roomId, updateAgreementBySlug]);

  // Lazily create + persist a Matrix room when the proposal has none yet.
  // Title and client callbacks stay in refs so a parent re-render cannot
  // cancel the in-flight create and leave the composer locked.
  React.useEffect(() => {
    if (!isMatrixAvailable || !documentSlug || roomId) return;
    void ensureRoom();
  }, [documentSlug, ensureRoom, isMatrixAvailable, roomId]);

  // Join, hydrate timeline, and listen for new messages.
  React.useEffect(() => {
    if (!isMatrixAvailable || !roomId) return;
    let cancelled = false;
    const rootId = roomId;

    const register = async (roomIdOrAlias: string) => {
      let canonicalId = roomIdOrAlias;
      try {
        setIsLoading(true);
        canonicalId = await joinRoomRef.current(roomIdOrAlias);
        if (cancelled) return;
        registeredRoomIdRef.current = canonicalId;
        if (canonicalId !== roomId) setRoomId(canonicalId);

        registerRoomListenerRef.current(
          canonicalId,
          async (message: Message) => {
            setMessages((prev) =>
              prev.some((item) => item.id === message.id)
                ? prev
                : [...prev, message],
            );
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

        try {
          await loadRoomHistoryRef.current(canonicalId, {
            pageSize: 50,
            maxBatches: 4,
          });
        } catch (error) {
          console.warn('[ProposalDiscussionChat] history load failed', error);
        }
        if (cancelled) return;
        const msgs = getRoomMessagesRef.current(canonicalId);
        if (msgs) setMessages(msgs);
        await getRoomMembersRef.current(canonicalId);
      } catch (error) {
        console.warn('[ProposalDiscussionChat] join failed', error);
        unregisterRoomListenerRef.current(canonicalId);
        registeredRoomIdRef.current = null;
        if (!cancelled) {
          setProvisionError(tRef.current('discussion.unavailable'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void register(rootId);
    return () => {
      cancelled = true;
      const id = registeredRoomIdRef.current ?? rootId;
      unregisterRoomListenerRef.current(id);
      registeredRoomIdRef.current = null;
    };
  }, [isMatrixAvailable, roomId]);

  React.useEffect(() => {
    if (!messages.length) return;
    document
      .getElementById(`proposal-discussion-bottom-${bottomId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [bottomId, messages.length]);

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
    const currentUserId = client.getUserId();
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
    return withMatrixAgentMention(
      list,
      tChat('agentMentionLabel'),
      matrixAgentSkills(tChat),
      { kind: 'space', logoUrl },
    );
  }, [client, mentionMembershipEpoch, resolvedTheme, roomId, space, tChat]);

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

  const sendMessage = React.useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const targetRoom = roomId ?? (await ensureRoom());
    if (!targetRoom) return;
    try {
      const { wirePlain, mentionUserIds } = wireComposerPlainForMatrixSend(
        input,
        mentionSanitizedLabelToUserId,
      );
      await sendMatrixMessage({
        roomId: targetRoom,
        message: wirePlain,
        mentionUserIds,
      });
      await inviteMatrixAgentIfNeeded(client, targetRoom, mentionUserIds);
      requestMatrixAgentReply({
        authToken,
        roomId: targetRoom,
        mentionUserIds,
      });
      setInput('');
    } catch (error) {
      console.warn('[ProposalDiscussionChat] send failed', error);
    }
  }, [
    authToken,
    client,
    ensureRoom,
    input,
    mentionSanitizedLabelToUserId,
    roomId,
    sendMatrixMessage,
  ]);

  const toggleChatPinnedMessage = React.useCallback(
    async (messageId: string) => {
      if (!roomId) return;
      await togglePinnedMessage(roomId, messageId);
    },
    [roomId, togglePinnedMessage],
  );

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
          <div className="max-h-[22rem] overflow-y-auto">
            <ChatMessageContainer
              messages={messages}
              isLoading={Boolean(roomId) && isLoading && messages.length === 0}
              togglePinnedMessage={toggleChatPinnedMessage}
            />
            <div id={`proposal-discussion-bottom-${bottomId}`} />
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
          />
        </>
      )}
    </section>
  );
}
