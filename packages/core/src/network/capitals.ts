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

/** One shared catalog. Spaces, signals, and tokens all use these keys. */
export const CAPITAL_FORM: {
  readonly [K in CapitalKey]: { readonly key: K; readonly order: number };
} = Object.fromEntries(CAPITALS.map((key, order) => [key, { key, order }])) as {
  readonly [K in CapitalKey]: { readonly key: K; readonly order: number };
};

const CAPITAL_KEY_SET = new Set<string>(CAPITALS);

/** Remembered on the network quick-create screen until the space exists. */
export const EXCHANGE_CAPITALS_DRAFT_KEY = 'hypha:exchange-capitals';

export function readExchangeCapitalsDraft(): {
  seeks: CapitalKey[];
  offers: CapitalKey[];
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(EXCHANGE_CAPITALS_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { seeks?: unknown; offers?: unknown };
    return {
      seeks: parseCapitalKeys(parsed.seeks),
      offers: parseCapitalKeys(parsed.offers),
    };
  } catch {
    return null;
  }
}

export function clearExchangeCapitalsDraft(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(EXCHANGE_CAPITALS_DRAFT_KEY);
}

export function parseCapitalKey(value: unknown): CapitalKey | null {
  if (typeof value !== 'string' || !CAPITAL_KEY_SET.has(value)) return null;
  return value as CapitalKey;
}

export function parseCapitalKeys(value: unknown): CapitalKey[] {
  if (!Array.isArray(value)) return [];
  const keys: CapitalKey[] = [];
  for (const entry of value) {
    const key = parseCapitalKey(entry);
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}
