/** Eleven forms of capital, in canonical order. Labels stay these words. */
export const CAPITALS = [
  { key: 'financial', label: 'Financial' },
  { key: 'material', label: 'Material' },
  { key: 'living', label: 'Living' },
  { key: 'wellbeing', label: 'Wellbeing' },
  { key: 'ecological', label: 'Ecological' },
  { key: 'experiential', label: 'Experiential' },
  { key: 'wisdom', label: 'Wisdom' },
  { key: 'social', label: 'Social' },
  { key: 'creative', label: 'Creative' },
  { key: 'cultural', label: 'Cultural' },
  { key: 'intellectual', label: 'Intellectual' },
] as const;

export type CapitalKey = (typeof CAPITALS)[number]['key'];

const CAPITAL_KEY_SET = new Set<string>(CAPITALS.map((capital) => capital.key));

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

export function capitalLabel(key: CapitalKey): string {
  return CAPITALS.find((capital) => capital.key === key)?.label ?? key;
}
