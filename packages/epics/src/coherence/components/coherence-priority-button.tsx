import { CardButton, CardButtonProps } from '../../common/card-button';
import { DynamicIcon, LucideReactIcon } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

export interface CoherencePriorityButtonProps extends CardButtonProps {
  icon: LucideReactIcon;
  iconColorVariant?: CardButtonProps['colorVariant'];
  onClick: () => void;
}

export const CoherencePriorityButton = ({
  icon,
  title,
  description,
  colorVariant,
  iconColorVariant,
  selected,
  className,
  onClick,
}: CoherencePriorityButtonProps) => {
  const iconClass = ((variant) => {
    switch (variant) {
      case 'error':
        return 'text-error-10';
      case 'warn':
        return 'text-warning-10';
      case 'success':
        return 'text-success-10';
      case 'accent':
        return 'text-accent-10';
      default:
        return 'text-neutral-11';
    }
  })(iconColorVariant ?? colorVariant);
  return (
    <CardButton
      className={cn('p-3', className)}
      selected={selected}
      colorVariant={colorVariant}
      onClick={onClick}
    >
      <div className="flex w-full flex-col items-center gap-1">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center">
          <DynamicIcon name={icon} size={20} className={iconClass} />
        </div>
        <span className="text-2 font-medium text-foreground text-center">
          {title}
        </span>
        <span className="text-1 text-muted-foreground text-center text-balance leading-snug">
          {description}
        </span>
      </div>
    </CardButton>
  );
};
