import { Badge } from './badge';

type BadgeProps = {};

const BADGE_VARIANTS: Record<string, BadgeProps> = {
  active: { variant: 'positive', children: 'Active' },
  voting: { variant: 'warning', children: 'On voting' },
  completed: { variant: 'action', children: 'Completed' },
  rejected: { variant: 'destructive', children: 'Rejected' },
  inactive: { variant: 'outlined', children: 'Inactive' },
  applicant: { variant: 'warning', children: 'Applicant' },
};
export const StatusBadge = ({
  status,
  isLoading,
}: {
  status?: string;
  isLoading: boolean | undefined;
}) => {
  const badge = BADGE_VARIANTS[status as keyof typeof BADGE_VARIANTS];
  return status ? <Badge isLoading={isLoading} {...badge} /> : null;
};
