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
