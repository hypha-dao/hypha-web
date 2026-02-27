export const COHERENCE_TYPES = [
  'Opportunity',
  'Risk',
  'Tension',
  'Insight',
  'Trend',
  'Proposal',
] as const;

export type CoherenceType = (typeof COHERENCE_TYPES)[number];

export const COHERENCE_TYPE_OPTIONS: {
  icon: string;
  colorVariant: string;
  type: CoherenceType;
  title: string;
  description: string;
}[] = [
  {
    icon: 'ArrowUpRight',
    colorVariant: 'success',
    type: 'Opportunity',
    title: 'Opportunity',
    description: 'Coordination window or positive opening',
  },
  {
    icon: 'TriangleAlert',
    colorVariant: 'error',
    type: 'Risk',
    title: 'Risk',
    description: 'Threat, concern or danger ahead',
  },
  {
    icon: 'Flame',
    colorVariant: 'tension',
    type: 'Tension',
    title: 'Tension',
    description: 'Conflict or disagreement needing resolution',
  },
  {
    icon: 'Lightbulb',
    colorVariant: 'insight',
    type: 'Insight',
    title: 'Insight',
    description: 'Data-driven observation or discovery',
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
