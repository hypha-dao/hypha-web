'use client';

import { useCallback, useState } from 'react';
import {
  acceptEnsuredPublicRoomId,
  distinctPublicRoomId,
  useMatrix,
} from '@hypha-platform/core/client';

import { useHumanChatPanel } from './human-chat-panel-context';

/** Open a space’s public channel (network connect) — never the member room. */
export function useOpenSpacePublicChat() {
  const { ensurePublicRoom, isMatrixAvailable, isAuthenticated, client } =
    useMatrix();
  const { openCoherenceChat, openHumanChatPanel } = useHumanChatPanel();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPublicChat = useCallback(
    async (space: {
      slug: string;
      title: string;
      description?: string | null;
      /** `spaces.chatRoomId` — so a misbound public alias can be detached. */
      memberRoomId?: string | null;
    }) => {
      const slug = space.slug.trim();
      if (!slug || opening) return false;
      if (!isMatrixAvailable || !isAuthenticated) {
        setError('matrix');
        return false;
      }
      setOpening(true);
      setError(null);
      try {
        const memberRoomId = space.memberRoomId?.trim() || null;
        const { roomId } = await ensurePublicRoom(slug, memberRoomId);
        const roomType = client?.getRoom(roomId)?.getType() ?? null;
        // Untyped rooms are still syncing create state — id check only.
        // A known member type, or an id that matches chatRoomId, is refused.
        const publicRoomId =
          roomType == null
            ? distinctPublicRoomId(roomId, memberRoomId)
            : acceptEnsuredPublicRoomId(roomId, memberRoomId, roomType);
        if (!publicRoomId) {
          throw new Error('Public channel resolved to the space channel');
        }
        openCoherenceChat(
          publicRoomId,
          space.title,
          '',
          space.description ?? null,
          slug,
          { public: true },
        );
        openHumanChatPanel();
        return true;
      } catch {
        setError('failed');
        return false;
      } finally {
        setOpening(false);
      }
    },
    [
      client,
      ensurePublicRoom,
      isAuthenticated,
      isMatrixAvailable,
      openCoherenceChat,
      openHumanChatPanel,
      opening,
    ],
  );

  return { openPublicChat, opening, error };
}
