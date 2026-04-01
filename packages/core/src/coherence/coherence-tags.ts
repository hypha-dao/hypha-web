export const COHERENCE_TAGS = [
  'Strategy',
  'Culture',
  'Onboarding',
  'Engagement',
  'Learning',
  'Capacity',
  'Network',
  'Reputation',
] as const;

export type CoherenceTag = (typeof COHERENCE_TAGS)[number];
