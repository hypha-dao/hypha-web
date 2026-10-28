const STORAGE_KEY = 'hypha.member-home.lead-rotation';

export const MEMBER_HOME_SPACE_LEAD_KEYS = [
  'spaceLead',
  'spaceLeadAlt2',
  'spaceLeadAlt3',
] as const;

export const MEMBER_HOME_PEOPLE_LEAD_KEYS = [
  'peopleAroundLead',
  'peopleAroundLeadAlt2',
  'peopleAroundLeadAlt3',
] as const;

export const MEMBER_HOME_TOKENS_LEAD_KEYS = [
  'tokensLead',
  'tokensLeadAlt2',
  'tokensLeadAlt3',
] as const;

type LeadKind = 'space' | 'people' | 'tokens';

/**
 * Advance a session counter so space/people/tokens chip leads rotate instead of
 * always repeating the same sentence (and never naming a "start here" person).
 */
export function nextMemberHomeLeadKey(
  kind: LeadKind,
  keys: readonly string[],
): string {
  if (keys.length === 0) return '';
  if (typeof window === 'undefined') return keys[0]!;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const state =
      raw && raw.startsWith('{')
        ? (JSON.parse(raw) as Record<string, number>)
        : {};
    const index = Number(state[kind] ?? 0);
    const safe = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
    const key = keys[safe % keys.length]!;
    state[kind] = safe + 1;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return key;
  } catch {
    return keys[0]!;
  }
}
