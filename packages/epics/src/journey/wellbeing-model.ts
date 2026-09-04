export const WELLBEING_DIMENSIONS = [
  'being',
  'thinking',
  'relating',
  'collaborating',
  'acting',
] as const;

export type WellbeingDimension = (typeof WELLBEING_DIMENSIONS)[number];

export type WellbeingFeeling =
  | 'thriving'
  | 'deepening'
  | 'steadying'
  | 'footing'
  | 'tending';

export type WellbeingScope = 'personal' | 'collective';

export const WELLBEING_MODES = ['standard', 'idg', 'nvc'] as const;

export type WellbeingMode = (typeof WELLBEING_MODES)[number];

export const DEFAULT_WELLBEING_MODE: WellbeingMode = 'idg';

export const STANDARD_CATEGORIES = [
  'experience',
  'action',
  'emotion',
  'decision',
  'discovery',
] as const;

export type StandardCategory = (typeof STANDARD_CATEGORIES)[number];

export const NVC_FIELDS = [
  'reaction',
  'happened',
  'feeling',
  'need',
  'request',
] as const;

export type NvcField = (typeof NVC_FIELDS)[number];

export const WELLBEING_TIMINGS = ['now', 'before'] as const;

export type WellbeingTiming = (typeof WELLBEING_TIMINGS)[number];

export const SUGGESTED_TOPICS = [
  'friends',
  'work',
  'health',
  'happiness',
  'money',
  'stress',
  'home',
  'circle',
] as const;

export const CATEGORY_TO_DIMENSION: Record<
  StandardCategory,
  WellbeingDimension
> = {
  experience: 'being',
  action: 'acting',
  emotion: 'relating',
  decision: 'thinking',
  discovery: 'collaborating',
};

export type JourneyAddonId = 'wellbeing' | 'energy' | 'water' | 'culture';

export type WellbeingMoment = {
  id: string;
  createdAt: string;
  personSlug: string;
  spaceSlug?: string;
  scope: WellbeingScope;
  /** Absent on pre-mode (IDG-only) moments — treat as `idg`. */
  mode?: WellbeingMode;
  dimension: WellbeingDimension;
  practiceId: string;
  felt: number;
  impact: number;
  score: number;
  title: string;
  category?: StandardCategory;
  /** Standard single note. Older moments may still hold the five split fields. */
  comment?: string;
  experience?: string;
  actionNote?: string;
  emotionNote?: string;
  decisionNote?: string;
  discoveryNote?: string;
  nvc?: Partial<Record<NvcField, string>>;
  topics?: string[];
  timing?: WellbeingTiming;
};

export type WellbeingInsightLevel =
  | 'personal'
  | 'space'
  | 'ecosystem'
  | 'network';

export type JourneyAddonState = {
  wellbeing: boolean;
  water: boolean;
  culture: boolean;
};

export type JourneyStoreState = {
  version: 1;
  personalActivated: boolean;
  personalActivatedAt?: string;
  preferredMode?: WellbeingMode;
  spaceModes?: Record<string, WellbeingMode>;
  moments: WellbeingMoment[];
  spaceAddons: Record<string, JourneyAddonState>;
};

export const WELLBEING_TOKEN_PRICE = 120;

export const WELLBEING_PRACTICES: Record<
  WellbeingDimension,
  readonly string[]
> = {
  being: ['presence', 'innerLife', 'grounding', 'rest', 'selfCompassion'],
  thinking: [
    'criticalThinking',
    'complexityAwareness',
    'perspectiveSkills',
    'senseMaking',
    'longTermOrientation',
  ],
  relating: ['empathy', 'humility', 'care', 'interconnection'],
  collaborating: ['trust', 'coCreation', 'inclusion', 'communication'],
  acting: ['courage', 'perseverance', 'creativity', 'stewardship'],
};

export const JOURNEY_ADDONS: readonly {
  id: JourneyAddonId;
  paid: boolean;
  available: boolean;
}[] = [
  { id: 'wellbeing', paid: true, available: true },
  { id: 'energy', paid: true, available: true },
  { id: 'water', paid: true, available: false },
  { id: 'culture', paid: true, available: false },
];

export function clampAxis(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Feeling / Standard / NVC matrix:
 * - X (`felt`): 0 = sad (left) → 100 = happy (right)
 * - Y (`impact`): 0 = low impact (bottom) → 100 = high impact (top)
 */
export function axesFromGridPointer(
  xRatio: number,
  yFromTopRatio: number,
): { felt: number; impact: number } {
  return {
    felt: clampAxis(xRatio * 100),
    impact: clampAxis((1 - yFromTopRatio) * 100),
  };
}

export function scoreFromAxes(felt: number, impact: number): number {
  return clampAxis(felt * 0.55 + impact * 0.45);
}

export function feelingFromScore(score: number): WellbeingFeeling {
  if (score >= 80) return 'thriving';
  if (score >= 65) return 'deepening';
  if (score >= 50) return 'steadying';
  if (score >= 35) return 'footing';
  return 'tending';
}

export function trendFromScores(
  current: number,
  previous: number | null,
): { delta: number; direction: 'up' | 'down' | 'steady' } {
  if (previous == null) {
    return { delta: 0, direction: 'steady' };
  }
  const delta = current - previous;
  if (delta >= 2) return { delta, direction: 'up' };
  if (delta <= -2) return { delta, direction: 'down' };
  return { delta, direction: 'steady' };
}

export function averageScore(moments: WellbeingMoment[]): number | null {
  if (moments.length === 0) return null;
  const total = moments.reduce((sum, moment) => sum + moment.score, 0);
  return clampAxis(total / moments.length);
}

export function recentMoments(
  moments: WellbeingMoment[],
  limit = 8,
): WellbeingMoment[] {
  return [...moments]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function momentsForScope(
  moments: WellbeingMoment[],
  options: { scope: WellbeingScope; spaceSlug?: string; personSlug?: string },
): WellbeingMoment[] {
  return moments.filter((moment) => {
    if (moment.scope !== options.scope) return false;
    if (options.spaceSlug && moment.spaceSlug !== options.spaceSlug) {
      return false;
    }
    if (options.personSlug && moment.personSlug !== options.personSlug) {
      return false;
    }
    return true;
  });
}

export function isWellbeingMode(value: unknown): value is WellbeingMode {
  return (
    typeof value === 'string' &&
    (WELLBEING_MODES as readonly string[]).includes(value)
  );
}

export function momentMode(
  moment: Pick<WellbeingMoment, 'mode'>,
): WellbeingMode {
  return moment.mode ?? DEFAULT_WELLBEING_MODE;
}

export function preferredModeFor(
  state: JourneyStoreState,
  spaceSlug?: string,
): WellbeingMode {
  if (spaceSlug) {
    return (
      state.spaceModes?.[spaceSlug] ??
      state.preferredMode ??
      DEFAULT_WELLBEING_MODE
    );
  }
  return state.preferredMode ?? DEFAULT_WELLBEING_MODE;
}

export function normalizeTopic(raw: string): string {
  return raw
    .replace(/^#/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .slice(0, 32);
}

export function extractTopics(...parts: Array<string | undefined>): string[] {
  const found = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const match of part.matchAll(/#([\p{L}\p{N}_-]{1,32})/gu)) {
      const topic = normalizeTopic(match[1] ?? '');
      if (topic) found.add(topic);
    }
  }
  return [...found];
}

export function parseTopicsInput(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,\s]+/)
        .map(normalizeTopic)
        .filter(Boolean),
    ),
  ];
}

export function createEmptyJourneyState(): JourneyStoreState {
  return {
    version: 1,
    personalActivated: false,
    preferredMode: DEFAULT_WELLBEING_MODE,
    spaceModes: {},
    moments: [],
    spaceAddons: {},
  };
}

export function createMomentId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `moment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
