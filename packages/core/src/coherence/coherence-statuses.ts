export const COHERENCE_STATUSES = ['signal', 'conversation'] as const;

export type CoherenceStatus = (typeof COHERENCE_STATUSES)[number];
