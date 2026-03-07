import {
  Badge,
  DynamicIcon,
  LucideReactIcon,
  type BadgeProps,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

export interface BadgeItem extends BadgeProps {
  icon?: LucideReactIcon;
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
          <span className="flex gap-1">
            {badge.icon && <DynamicIcon name={badge.icon} size={16} />}
            {badge.label}
          </span>
        </Badge>
      ))}
    </div>
  );
};
