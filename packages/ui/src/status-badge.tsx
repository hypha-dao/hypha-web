import { Badge } from './badge';

type StatusBadgeProps = {
  status?: string;
  isLoading?: boolean;
};

type BadgeVariant = 'solid' | 'soft' | 'outline' | 'surface';
type BadgeColorVariant = 'accent' | 'error' | 'warn' | 'neutral' | 'success';

const BADGE_VARIANTS: Record<
  string,
  { variant: BadgeVariant; colorVariant: BadgeColorVariant; children: string }
> = {
  active: { variant: 'surface', colorVariant: 'success', children: 'Active' },
  voting: { variant: 'surface', colorVariant: 'warn', children: 'On voting' },
  completed: {
    variant: 'surface',
    colorVariant: 'accent',
    children: 'Completed',
  },
  rejected: { variant: 'surface', colorVariant: 'error', children: 'Rejected' },
  inactive: {
    variant: 'surface',
    colorVariant: 'neutral',
    children: 'Inactive',
  },
  applicant: {
    variant: 'surface',
    colorVariant: 'warn',
    children: 'Applicant',
  },
};

export const StatusBadge = ({
  status,
  isLoading = false,
}: StatusBadgeProps) => {
  const badge = BADGE_VARIANTS[status as keyof typeof BADGE_VARIANTS];
  return status ? <Badge isLoading={isLoading} {...badge} /> : null;
};
