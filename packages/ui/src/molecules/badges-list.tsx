import { Badge, type BadgeProps } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

export interface BadgeItem extends BadgeProps {
  label: string | number;
}

interface BadgesListProps {
  badges: BadgeItem[];
  isLoading?: boolean;
  className?: string;
}

export const BadgesList = ({
  badges,
  isLoading,
  className,
}: BadgesListProps) => {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {badges.map((badge, index) => (
        <Badge
          key={`${badge.label} ${index}`}
          className={badge.className}
          isLoading={isLoading}
          variant={badge.variant}
          colorVariant={badge.colorVariant}
        >
          {badge.label}
        </Badge>
      ))}
    </div>
  );
};
