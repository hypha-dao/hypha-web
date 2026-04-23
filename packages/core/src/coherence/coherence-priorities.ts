export const COHERENCE_PRIORITIES = ['high', 'medium', 'low'] as const;

export type CoherencePriority = (typeof COHERENCE_PRIORITIES)[number];

/** Icon names used by priority options — matches `DynamicIcon` / Lucide registry. */
export type CoherencePriorityIconName = 'CircleAlert' | 'CircleDot' | 'Circle';

export const COHERENCE_PRIORITY_OPTIONS: {
  priority: CoherencePriority;
  /** Lucide icon name (see `DynamicIcon` in @hypha-platform/ui). */
  icon: CoherencePriorityIconName;
  title: string;
  description: string;
  colorVariant: string;
}[] = [
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
