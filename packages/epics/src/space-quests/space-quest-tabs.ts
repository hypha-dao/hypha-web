/** Server-safe quest detail tabs. Do not move this into a `'use client'` module. */
export const SPACE_QUEST_DETAIL_TABS = [
  'overview',
  'updates',
  'settings',
] as const;

export type SpaceQuestDetailTab = (typeof SPACE_QUEST_DETAIL_TABS)[number];

const RETIRED_QUEST_PARTICIPANT_TABS = ['members', 'participants'] as const;

export function isSpaceQuestDetailTab(
  value: unknown,
): value is SpaceQuestDetailTab {
  return (
    typeof value === 'string' &&
    (SPACE_QUEST_DETAIL_TABS as readonly string[]).includes(value)
  );
}

/** The old Participants tab. Overview already shows that roster. */
export function isRetiredQuestParticipantTab(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return (RETIRED_QUEST_PARTICIPANT_TABS as readonly string[]).includes(
    normalized,
  );
}

export function questDetailSearchTargetsParticipantTab(
  searchParams:
    | Record<string, string | string[] | undefined>
    | undefined
    | null,
): boolean {
  if (!searchParams) return false;
  for (const key of ['tab', 'questTab'] as const) {
    const raw = searchParams[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (isRetiredQuestParticipantTab(value)) return true;
  }
  return false;
}

export function spaceQuestDetailTabLinks(
  baseHref: string,
): Array<{ key: SpaceQuestDetailTab; label: string; href: string }> {
  return [
    { key: 'overview', label: 'OVERVIEW', href: baseHref },
    { key: 'updates', label: 'UPDATES', href: `${baseHref}/updates` },
    { key: 'settings', label: 'SETTINGS', href: `${baseHref}/settings` },
  ];
}
