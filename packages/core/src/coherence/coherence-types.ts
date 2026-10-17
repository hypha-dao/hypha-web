export const COHERENCE_SIGNAL_TYPES = [
  'Need',
  'Resource',
  'Opportunity',
  'Insight',
  'Tension',
  'Risk',
  'Action',
  'Impact',
] as const;

export type CoherenceSignalType = (typeof COHERENCE_SIGNAL_TYPES)[number];

export const COHERENCE_TYPES = [
  ...COHERENCE_SIGNAL_TYPES,
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
    icon: 'HandHelping',
    colorVariant: 'success',
    type: 'Need',
    title: 'Need',
    description: 'Someone is asking for a hand',
  },
  {
    icon: 'Package',
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
    icon: 'ListChecks',
    colorVariant: 'neutral',
    type: 'Action',
    title: 'Action',
    description: 'A concrete step someone can take',
  },
  {
    icon: 'Sprout',
    colorVariant: 'success',
    type: 'Impact',
    title: 'Impact',
    description: 'What changed because people acted',
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
