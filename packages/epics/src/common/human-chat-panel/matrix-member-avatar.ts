import { DEFAULT_SPACE_AVATAR_IMAGE } from '../../../../core/src/assets/constant';
import type { MatrixClient } from 'matrix-js-sdk';

/**
 * Matrix member avatar → HTTP thumbnail for `<img>`.
 * Same sources as the Messages list: room member MXC, then the global user
 * store (group headers often miss room-member avatars while `getUser` has them).
 */
export function matrixMemberAvatarSquare(
  client: MatrixClient | null | undefined,
  roomId: string | null | undefined,
  userId: string | undefined,
  px: number,
): string | undefined {
  if (!client || !userId) return undefined;
  const room = roomId ? client.getRoom(roomId) : null;
  const member = room?.getMember(userId);
  const mxc =
    member?.getMxcAvatarUrl() || client.getUser(userId)?.avatarUrl || undefined;
  if (!mxc || !String(mxc).startsWith('mxc://')) return undefined;
  // Match Messages `avatarHttp` — that URL shape already loads in the inbox.
  return client.mxcUrlToHttp(mxc, px, px, 'crop') ?? undefined;
}

/**
 * Portrait for a called AI agent in chat.
 * The Matrix profile picture wins (what Signals already shows). The space
 * logo, then the same default mark as the @ row, covers a bot with no photo
 * so the bubble does not fall through to letter initials.
 */
export function calledAgentAvatarUrl({
  matrixAvatarUrl,
  spaceLogoUrl,
}: {
  matrixAvatarUrl?: string | null;
  spaceLogoUrl?: string | null;
}): string {
  const matrix = matrixAvatarUrl?.trim();
  if (matrix) return matrix;
  const logo = spaceLogoUrl?.trim();
  if (logo) return logo;
  return DEFAULT_SPACE_AVATAR_IMAGE;
}
