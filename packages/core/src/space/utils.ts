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
    space.flags?.includes('archived') === true ||
    (space.memberCount !== undefined && space.memberCount === 0)
  );
}
