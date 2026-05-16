'use client';

import React from 'react';
import { RoomStateEvent } from 'matrix-js-sdk';
import {
  useCoherenceMutationsWeb2Rsc,
  useJwt,
  useMatrix,
} from '@hypha-platform/core/client';
import { Button, ConfirmDialog } from '@hypha-platform/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  HumanChatPanelChatBar,
  type ChatMentionCandidate,
} from '../../common/human-chat-panel';
import {
  matrixMemberDisplayLabel,
  shortenMatrixIdForDisplay,
} from '../../common/human-chat-panel/matrix-room-member-display';
import {
  sanitizeMentionDisplayLabel,
  wireComposerPlainForMatrixSend,
} from '../../common/human-chat-panel/human-chat-display-mention';

/** Sanitized labels shared by multiple members need a disambiguated composer token + map key. */
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
  key = sanitizeMentionDisplayLabel(`${displayLabel} (${short})`);
  if (!key) return sanitizeMentionDisplayLabel(userId);
  return key;
}

export const ChatMessageInput = ({
  roomId,
  coherenceSlug,
  closeUrl,
}: {
  roomId: string;
  coherenceSlug: string;
  closeUrl: string;
}) => {
  const t = useTranslations('CoherenceTab');
  const { client, sendMessage: sendMatrixMessage } = useMatrix();
  const [input, setInput] = React.useState('');
  const [mentionMembershipEpoch, setMentionMembershipEpoch] = React.useState(0);
  const { jwt: authToken } = useJwt();
  const { updateCoherenceBySlug } = useCoherenceMutationsWeb2Rsc(authToken);
  const router = useRouter();

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
    return list;
  }, [client, roomId, mentionMembershipEpoch]);

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

  /** Sanitized display label -> MXID for converting composer `@Name` tokens before Matrix send. */
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

  const mentionPickerEnabled = mentionCandidates.length > 0;

  React.useEffect(() => {
    if (!client || !roomId) return;
    const room = client.getRoom(roomId);
    if (!room) return;

    const bumpMembership = (...args: unknown[]) => {
      const state = args[1] as { roomId?: string } | undefined;
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
      setInput('');
    } catch (error) {
      console.warn(error);
    }
  }, [input, mentionSanitizedLabelToUserId, roomId, sendMatrixMessage]);

  const handleArchive = React.useCallback(async () => {
    try {
      await updateCoherenceBySlug({ slug: coherenceSlug, archived: true });
      router.push(closeUrl);
    } catch (error) {
      console.warn('Could not archive conversation:', error);
    }
  }, [coherenceSlug, router, closeUrl, updateCoherenceBySlug]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-grow text-1 text-neutral-11 gap-3">
        <ConfirmDialog
          title="Archive Conversation"
          description="Do you really want to archive this conversation?"
          customAcceptButtonText="Yes, archive"
          customRejectButtonText="No, leave"
          onAcceptClicked={handleArchive}
        >
          <Button
            variant="outline"
            colorVariant="neutral"
            className="bg-transparent text-neutral-11"
          >
            Archive Conversation
          </Button>
        </ConfirmDialog>
        <Button
          variant="outline"
          colorVariant="accent"
          className="grow"
          onClick={() => {
            console.log('Propose Agreement clicked');
            //TODO
          }}
        >
          Propose Agreement
        </Button>
      </div>
      <div className="w-full">
        <HumanChatPanelChatBar
          value={input}
          onChange={setInput}
          onSend={sendMessage}
          placeholder={t('saySomething')}
          mentionCandidates={mentionCandidates}
          mentionPickerEnabled={mentionPickerEnabled}
          getMentionComposerLabel={getMentionComposerLabel}
        />
      </div>
    </div>
  );
};
