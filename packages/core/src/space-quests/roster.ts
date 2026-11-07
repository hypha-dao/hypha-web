/**
 * Newly assigned quest lead/member person IDs must be on the space roster.
 * Already-saved IDs may remain even if the person left the space.
 */
export function offRosterQuestPersonIds(
  assignedIds: ReadonlyArray<number | null | undefined>,
  rosterIds: ReadonlySet<number>,
  preservedIds: ReadonlySet<number> = new Set(),
): number[] {
  const seen = new Set<number>();
  const offRoster: number[] = [];
  for (const id of assignedIds) {
    if (typeof id !== 'number' || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    if (preservedIds.has(id) || rosterIds.has(id)) continue;
    offRoster.push(id);
  }
  return offRoster;
}
