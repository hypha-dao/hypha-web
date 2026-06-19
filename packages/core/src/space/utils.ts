/**
 * True when the space carries the explicit archived flag in the database.
 */
export function isSpaceExplicitlyArchived(space: {
  flags?: string[];
}): boolean {
  return space.flags?.includes('archived') === true;
}

/**
 * Determines if a space should be considered archived.
 * A space is archived if:
 * - It has the 'archived' flag, OR
 * - It has 0 members (memberCount is explicitly 0 from Web3 data)
 *
 * Network explore uses {@link isSpaceExplicitlyArchived} instead so publicly
 * discoverable spaces with no members yet (e.g. Hypha Energy) remain visible.
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
