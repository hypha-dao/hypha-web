export const COHERENCE_TYPES = [
  'Opportunity',
  'Tension',
  'Risk',
  'Strategy',
  'Innovation',
  'Culture',
  'Onboarding',
  'Engagement',
  'Learning',
  'Network',
  'Capacity',
  'Reputation',
  'Impact',
  'Funding',
  'Budget',
] as const;

export type CoherenceType = (typeof COHERENCE_TYPES)[number];
