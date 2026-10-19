import {
  getMatrixBotAsToken,
  getMatrixHomeserverUrl,
  matrixGetJoinOrInviteRoomMembers,
} from '@hypha-platform/core/server';
import { selectDirectRecipient } from './direct-recipient';

/**
 * When a room is not a space or signal thread, decide whether it is a private message.
 * Returns the other person's Matrix id, or null when it is not a 1:1 (or membership
 * cannot be read). A lookup failure stays null so one unmapped room cannot stall the
 * homeserver transaction queue.
 */
export async function resolveDirectRecipient(
  roomId: string,
  senderMxid: string,
  botUserIds: ReadonlySet<string>,
): Promise<string | null> {
  const asToken = getMatrixBotAsToken();
  const homeserver = getMatrixHomeserverUrl();
  if (!asToken || !homeserver) return null;

  try {
    const members = await matrixGetJoinOrInviteRoomMembers(
      roomId,
      asToken,
      homeserver,
    );
    return selectDirectRecipient(members, senderMxid, botUserIds);
  } catch (error) {
    console.error('[matrix-as] failed to resolve a private-message recipient', {
      roomId,
      error,
    });
    return null;
  }
}
