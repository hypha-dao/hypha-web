const CAPITALS = [
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

type CapitalKey = (typeof CAPITALS)[number];

const CAPITAL_KEY_SET = new Set<string>(CAPITALS);

function parseCapitalKeys(value: unknown): CapitalKey[] {
  if (!Array.isArray(value)) return [];
  const keys: CapitalKey[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !CAPITAL_KEY_SET.has(entry)) continue;
    const key = entry as CapitalKey;
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

type ExchangeSide = {
  slug: string;
  seeks: string[];
  offers: string[];
};

/** Share of stated needs the other side already offers. Null when neither side has named a need. */
export function reciprocityPercent(
  left: ExchangeSide,
  right: ExchangeSide,
): number | null {
  const leftSeeks = parseCapitalKeys(left.seeks);
  const rightSeeks = parseCapitalKeys(right.seeks);
  const needed = leftSeeks.length + rightSeeks.length;
  if (needed === 0) return null;
  const met =
    parseCapitalKeys(right.offers).filter((key) => leftSeeks.includes(key))
      .length +
    parseCapitalKeys(left.offers).filter((key) => rightSeeks.includes(key))
      .length;
  return Math.round((met / needed) * 100);
}

export function capitalsMeeting(
  seeks: string[],
  offers: string[],
): CapitalKey[] {
  const wanted = new Set(parseCapitalKeys(seeks));
  return parseCapitalKeys(offers).filter((key) => wanted.has(key));
}

export type ExchangePair<T extends ExchangeSide> = {
  left: T;
  right: T;
  percent: number;
  leftMeets: CapitalKey[];
  rightMeets: CapitalKey[];
};

/** Unordered pairs with a real overlap, strongest first. */
export function exchangePairs<T extends ExchangeSide>(
  spaces: readonly T[],
): ExchangePair<T>[] {
  const pairs: ExchangePair<T>[] = [];
  for (let leftIndex = 0; leftIndex < spaces.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < spaces.length;
      rightIndex += 1
    ) {
      const left = spaces[leftIndex];
      const right = spaces[rightIndex];
      if (!left || !right) continue;
      const percent = reciprocityPercent(left, right);
      if (percent == null || percent <= 0) continue;
      pairs.push({
        left,
        right,
        percent,
        leftMeets: capitalsMeeting(right.seeks, left.offers),
        rightMeets: capitalsMeeting(left.seeks, right.offers),
      });
    }
  }
  return pairs.sort((left, right) => right.percent - left.percent);
}
