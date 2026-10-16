'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
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
  className,
}: {
  documentSlug: string;
  title?: string;
  initialChatRoomId?: string | null;
  className?: string;
}) {
  const t = useTranslations('ProposalDetails');
  const tChat = useTranslations('HumanChatPanel');
  const tCoherence = useTranslations('CoherenceTab');
  const { jwt: authToken } = useJwt();
  const { updateAgreementBySlug } = useAgreementMutationsWeb2Rsc(authToken);
  const {
    isMatrixAvailable,
    client,
    createRoom,
    joinRoom,
    getRoomMessages,
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
  const provisioningRef = React.useRef(false);
  const provisionFailedRef = React.useRef(false);
  const bottomId = React.useId();

  React.useEffect(() => {
    const next = initialChatRoomId?.trim() || null;
    if (next && next !== roomId) setRoomId(next);
  }, [initialChatRoomId, roomId]);

  // Lazily create + persist a Matrix room when the proposal has none yet.
  React.useEffect(() => {
    if (
      !isMatrixAvailable ||
      !documentSlug ||
      roomId ||
      provisioningRef.current ||
      provisionFailedRef.current
    ) {
      return;
    }
    let cancelled = false;
    provisioningRef.current = true;
    setProvisionError(null);
    setIsLoading(true);

    const roomTitle = title?.trim()
      ? t('discussion.roomTitle', { title: title.trim() })
      : t('discussion.roomTitleFallback');

    (async () => {
      try {
        const created = await createRoom(roomTitle, {
          grantCreatorPl100: true,
        });
        const canonicalId = await joinRoom(created.roomId);
        if (cancelled) return;
        await updateAgreementBySlug({
          slug: documentSlug,
          chatRoomId: canonicalId,
        });
        if (cancelled) return;
        setRoomId(canonicalId);
      } catch (error) {
        console.warn(
          '[ProposalDiscussionChat] room provisioning failed',
          error,
        );
        provisionFailedRef.current = true;
        if (!cancelled) {
          setProvisionError(t('discussion.unavailable'));
        }
      } finally {
        provisioningRef.current = false;
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    createRoom,
    documentSlug,
    isMatrixAvailable,
    joinRoom,
    roomId,
    t,
    title,
    updateAgreementBySlug,
  ]);

  // Join, hydrate timeline, and listen for new messages.
  React.useEffect(() => {
    if (!isMatrixAvailable || !roomId) return;
    let cancelled = false;
    const rootId = roomId;

    const register = async (roomIdOrAlias: string) => {
      let canonicalId = roomIdOrAlias;
      try {
        setIsLoading(true);
        canonicalId = await joinRoom(roomIdOrAlias);
        if (cancelled) return;
        registeredRoomIdRef.current = canonicalId;
        if (canonicalId !== roomId) setRoomId(canonicalId);

        registerRoomListener(
          canonicalId,
          async (message: Message) => {
            setMessages((prev) => [...prev, message]);
            await getRoomMembers(canonicalId);
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

        const msgs = getRoomMessages(canonicalId);
        if (msgs) setMessages(msgs);
        await getRoomMembers(canonicalId);
      } catch (error) {
        console.warn('[ProposalDiscussionChat] join failed', error);
        unregisterRoomListener(canonicalId);
        registeredRoomIdRef.current = null;
        if (!cancelled) setProvisionError(t('discussion.unavailable'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void register(rootId);
    return () => {
      cancelled = true;
      const id = registeredRoomIdRef.current ?? rootId;
      unregisterRoomListener(id);
      registeredRoomIdRef.current = null;
    };
  }, [
    getRoomMembers,
    getRoomMessages,
    isMatrixAvailable,
    joinRoom,
    registerRoomListener,
    roomId,
    t,
    unregisterRoomListener,
  ]);

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
    return withMatrixAgentMention(
      list,
      tChat('agentMentionLabel'),
      matrixAgentSkills(tChat),
      { kind: 'space' },
    );
  }, [client, roomId, mentionMembershipEpoch, tChat]);

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
    if (!trimmed || !roomId) return;
    try {
      const { wirePlain, mentionUserIds } = wireComposerPlainForMatrixSend(
        input,
        mentionSanitizedLabelToUserId,
      );
      await sendMatrixMessage({
        roomId,
        message: wirePlain,
        mentionUserIds,
      });
      await inviteMatrixAgentIfNeeded(client, roomId, mentionUserIds);
      requestMatrixAgentReply({
        authToken,
        roomId,
        mentionUserIds,
      });
      setInput('');
    } catch (error) {
      console.warn('[ProposalDiscussionChat] send failed', error);
    }
  }, [
    authToken,
    client,
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
              isLoading={isLoading && messages.length === 0}
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
            composerLocked={!roomId || Boolean(provisionError)}
            composerLockedMessage={provisionError ?? t('discussion.connecting')}
          />
        </>
      )}
    </section>
  );
}
