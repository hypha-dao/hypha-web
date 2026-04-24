import { CardButton, CardButtonProps } from '../../common/card-button';
import { DynamicIcon, LucideReactIcon } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

export interface CoherencePriorityButtonProps extends CardButtonProps {
  icon: LucideReactIcon;
  onClick: () => void;
}

export const CoherencePriorityButton = ({
  icon,
  title,
  description,
  colorVariant,
  selected,
  className,
  onClick,
}: CoherencePriorityButtonProps) => {
  const textClass = ((variant) => {
    switch (variant) {
      case 'subtle':
        return 'text-foreground';
      case 'error':
        return 'text-error-9';
      case 'warn':
        return 'text-warning-11';
      case 'success':
        return 'text-success-11';
      default:
        return 'text-neutral-9';
    }
  })(colorVariant);
  return (
    <CardButton
      className={cn('p-3', className)}
      selected={selected}
      colorVariant={colorVariant}
      onClick={onClick}
    >
      <div className="w-full flex flex-col gap-1 items-center">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-[border-color,box-shadow,ring-color] duration-200',
            selected
              ? 'border-accent-9 bg-muted/40 ring-2 ring-accent-10/45'
              : 'border-transparent',
          )}
        >
          <DynamicIcon name={icon} size={16} className={textClass} />
        </div>
        <span className={cn('text-2 font-medium', textClass)}>{title}</span>
        <span
          className={
            colorVariant === 'subtle'
              ? 'text-1 text-muted-foreground'
              : 'text-1 text-neutral-11'
          }
        >
          {description}
        </span>
      </div>
    </CardButton>
  );
};
