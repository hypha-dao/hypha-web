import type { SpaceOrder } from '../categories/types';

/**
 * True when the space carries the explicit archived flag in the database.
 */
export function isSpaceExplicitlyArchived(space: {
  flags?: string[];
}): boolean {
  return space.flags?.includes('archived') === true;
}

/**
 * Fields required to rank spaces. Kept structural so this can be shared between
 * the server (RSC first paint) and the client without importing the full Space
 * type in either direction.
 */
type SpaceSortFields = {
  id: number;
  memberAddresses?: readonly unknown[] | null;
  memberCount?: number;
  documentCount?: number;
};

/**
 * Deterministically orders spaces by the given {@link SpaceOrder}.
 *
 * Used both on the server (so the initial HTML is already sorted) and on the
 * client (after category / discoverability filtering). Sharing one comparator
 * guarantees the server first paint and the client hydration agree, which
 * prevents the network cards from visibly reordering on first load.
 */
export function sortSpacesByOrder<T extends SpaceSortFields>(
  spaces: T[],
  order: SpaceOrder,
): T[] {
  const compareMembers = (a: T, b: T) =>
    (b.memberAddresses?.length ?? b.memberCount ?? 0) -
    (a.memberAddresses?.length ?? a.memberCount ?? 0);
  const compareAgreements = (a: T, b: T) =>
    (b.documentCount ?? 0) - (a.documentCount ?? 0);
  const compareRecent = (a: T, b: T) => b.id - a.id;

  return [...spaces].sort((a, b) => {
    switch (order) {
      case 'mostmembers':
        return compareMembers(a, b);
      case 'mostagreements':
        return compareAgreements(a, b);
      case 'mostrecent':
        return compareRecent(a, b);
      default:
        return 0;
    }
  });
}

/**
 * Determines if a space should be considered archived.
 * A space is archived if:
 * - It has the 'archived' flag, OR
 * - It has 0 members (memberCount is explicitly 0 from Web3 data)
 */
export function isSpaceArchived(space: {
  flags?: string[];
  memberCount?: number;
}): boolean {
  return (
    isSpaceExplicitlyArchived(space) ||
    (space.memberCount !== undefined && space.memberCount === 0)
  );
}
