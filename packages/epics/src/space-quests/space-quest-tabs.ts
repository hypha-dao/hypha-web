/** Server-safe quest detail tabs. Do not move this into a `'use client'` module. */
export const SPACE_QUEST_DETAIL_TABS = [
  'overview',
  'updates',
  'members',
  'settings',
] as const;

export type SpaceQuestDetailTab = (typeof SPACE_QUEST_DETAIL_TABS)[number];

export function isSpaceQuestDetailTab(
  value: unknown,
): value is SpaceQuestDetailTab {
  return (
    typeof value === 'string' &&
    (SPACE_QUEST_DETAIL_TABS as readonly string[]).includes(value)
  );
}
