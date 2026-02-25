export const COHERENCE_TYPES = [
  'Opportunity',
  'Risk',
  'Tension',
  'Insight',
  'Trend',
  'Proposal',
] as const;

export type CoherenceType = (typeof COHERENCE_TYPES)[number];
