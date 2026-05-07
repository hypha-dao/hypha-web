export const COHERENCE_PRIORITIES = [
  'critical',
  'high',
  'medium',
  'low',
] as const;

export type CoherencePriority = (typeof COHERENCE_PRIORITIES)[number];

/** Icon names used by priority options — matches `DynamicIcon` / Lucide registry. */
export type CoherencePriorityIconName =
  | 'OctagonAlert'
  | 'CircleAlert'
  | 'CircleDot'
  | 'Circle';

export const COHERENCE_PRIORITY_OPTIONS: {
  priority: CoherencePriority;
  /** Lucide icon name (see `DynamicIcon` in @hypha-platform/ui). */
  icon: CoherencePriorityIconName;
  title: string;
  description: string;
  colorVariant: string;
}[] = [
  {
    priority: 'critical',
    icon: 'OctagonAlert',
    title: 'Critical',
    colorVariant: 'error',
    description: 'Immediate action required',
  },
  {
    priority: 'high',
    icon: 'CircleAlert',
    title: 'High',
    colorVariant: 'error',
    description: 'Needs immediate attention',
  },
  {
    priority: 'medium',
    icon: 'CircleDot',
    title: 'Medium',
    colorVariant: 'warn',
    description: 'Monitor and act soon',
  },
  {
    priority: 'low',
    icon: 'Circle',
    title: 'Low',
    colorVariant: 'success',
    description: 'Informational, no rush',
  },
];
