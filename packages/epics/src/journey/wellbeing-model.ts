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

export type JourneyAddonId = 'wellbeing' | 'energy' | 'water' | 'culture';

export type WellbeingMoment = {
  id: string;
  createdAt: string;
  personSlug: string;
  spaceSlug?: string;
  scope: WellbeingScope;
  dimension: WellbeingDimension;
  practiceId: string;
  felt: number;
  impact: number;
  score: number;
  title: string;
};

export type JourneyAddonState = {
  wellbeing: boolean;
  water: boolean;
  culture: boolean;
};

export type JourneyStoreState = {
  version: 1;
  personalActivated: boolean;
  personalActivatedAt?: string;
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

export function createEmptyJourneyState(): JourneyStoreState {
  return {
    version: 1,
    personalActivated: false,
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
