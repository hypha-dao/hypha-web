export const COHERENCE_PRIORITIES = [
  'critical',
  'high',
  'medium',
  'low',
] as const;

export type CoherencePriority = (typeof COHERENCE_PRIORITIES)[number];
