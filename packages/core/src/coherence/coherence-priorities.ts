export const COHERENCE_PRIORITIES = ['high', 'medium', 'low'] as const;

export type CoherencePriority = (typeof COHERENCE_PRIORITIES)[number];

export const COHERENCE_PRIORITY_OPTIONS: {
  priority: CoherencePriority;
  title: string;
  description: string;
  colorVariant: string;
}[] = [
  {
    priority: 'high',
    title: 'High',
    colorVariant: 'error',
    description: 'Needs immediate attention',
  },
  {
    priority: 'medium',
    title: 'Medium',
    colorVariant: 'warn',
    description: 'Monitor and act soon',
  },
  {
    priority: 'low',
    title: 'Low',
    colorVariant: 'success',
    description: 'Informational, no rush',
  },
];
