export const COHERENCE_SIGNAL_TYPES = [
  'Need',
  'Resource',
  'Opportunity',
  'Insight',
  'Tension',
  'Risk',
  'Action',
  'Bug',
] as const;

export type CoherenceSignalType = (typeof COHERENCE_SIGNAL_TYPES)[number];

export const COHERENCE_TYPES = [
  ...COHERENCE_SIGNAL_TYPES,
  'Trend',
  'Proposal',
] as const;

export type CoherenceType = (typeof COHERENCE_TYPES)[number];

/**
 * Impact evidence is proof of action now. Reads and writes treat a stored
 * `Impact` as `Action` so older signals stay visible while the data moves.
 */
export function canonicalSignalType(type: string | null | undefined): string {
  const value = type?.trim() ?? '';
  return value === 'Impact' ? 'Action' : value;
}

/** Query values, including the legacy `Impact` rows that now mean `Action`. */
export function storedSignalTypes(types: readonly string[]): string[] {
  const stored = new Set<string>();
  for (const type of types) {
    const canonical = canonicalSignalType(type);
    if (!canonical) continue;
    stored.add(canonical);
    if (canonical === 'Action') stored.add('Impact');
  }
  return [...stored];
}

export const COHERENCE_TYPE_OPTIONS: {
  icon: string;
  colorVariant: string;
  type: CoherenceType;
  title: string;
  description: string;
}[] = [
  {
    icon: 'Megaphone',
    colorVariant: 'success',
    type: 'Need',
    title: 'Need',
    description: 'Someone is asking for a hand',
  },
  {
    icon: 'Layers',
    colorVariant: 'neutral',
    type: 'Resource',
    title: 'Resource',
    description: 'Something that can be shared or drawn on',
  },
  {
    icon: 'ArrowUpRight',
    colorVariant: 'success',
    type: 'Opportunity',
    title: 'Opportunity',
    description: 'Coordination window or positive opening',
  },
  {
    icon: 'Lightbulb',
    colorVariant: 'insight',
    type: 'Insight',
    title: 'Insight',
    description: 'Data-driven observation or discovery',
  },
  {
    icon: 'Flame',
    colorVariant: 'tension',
    type: 'Tension',
    title: 'Tension',
    description: 'Conflict or disagreement needing resolution',
  },
  {
    icon: 'TriangleAlert',
    colorVariant: 'error',
    type: 'Risk',
    title: 'Risk',
    description: 'Threat, concern or danger ahead',
  },
  {
    icon: 'Receipt',
    colorVariant: 'neutral',
    type: 'Action',
    title: 'Proof of Action',
    description: 'Stories and real-world outcomes',
  },
  {
    icon: 'Bug',
    colorVariant: 'error',
    type: 'Bug',
    title: 'Bug',
    description: 'Something is broken',
  },
  {
    icon: 'TrendingUp',
    colorVariant: 'warn',
    type: 'Trend',
    title: 'Trend',
    description: 'Emerging pattern across spaces',
  },
  {
    icon: 'FileText',
    colorVariant: 'accent',
    type: 'Proposal',
    title: 'Proposal',
    description: 'Governance action or vote needed',
  },
] as const;
