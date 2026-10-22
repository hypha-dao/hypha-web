export type PendingSpaceInvite = {
  id: number;
  spaceId: number;
};

/**
 * Invites whose space is already in the person's memberships are no longer
 * pending. Everything else stays visible.
 */
export function splitInvitesByMembership<T extends PendingSpaceInvite>(
  invites: readonly T[],
  memberSpaceIds: ReadonlySet<number>,
): { pending: T[]; joinedInviteIds: number[] } {
  const pending: T[] = [];
  const joinedInviteIds: number[] = [];
  for (const invite of invites) {
    if (memberSpaceIds.has(invite.spaceId)) {
      joinedInviteIds.push(invite.id);
    } else {
      pending.push(invite);
    }
  }
  return { pending, joinedInviteIds };
}
