/** Eleven forms of capital, in canonical order. Names are translated in the UI. */
export const CAPITALS = [
  'financial',
  'material',
  'living',
  'wellbeing',
  'ecological',
  'experiential',
  'wisdom',
  'social',
  'creative',
  'cultural',
  'intellectual',
] as const;

export type CapitalKey = (typeof CAPITALS)[number];

const CAPITAL_KEY_SET = new Set<string>(CAPITALS);

export function parseCapitalKeys(value: unknown): CapitalKey[] {
  if (!Array.isArray(value)) return [];
  const keys: CapitalKey[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !CAPITAL_KEY_SET.has(entry)) continue;
    const key = entry as CapitalKey;
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}
