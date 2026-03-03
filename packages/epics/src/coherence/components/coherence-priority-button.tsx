import { CardButton, CardButtonProps } from '../../common/card-button';
import { cn } from '@hypha-platform/ui-utils';
import { Circle } from 'lucide-react';

export interface CoherencePriorityButtonProps extends CardButtonProps {
  onClick: () => void;
}

export const CoherencePriorityButton = ({
  title,
  description,
  colorVariant,
  selected,
  className,
  onClick,
}: CoherencePriorityButtonProps) => {
  const textClass = ((variant) => {
    switch (variant) {
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
  const textColor = ((variant) => {
    switch (variant) {
      case 'error':
        return 'var(--error-9)';
      case 'warn':
        return 'var(--warning-11)';
      case 'success':
        return 'var(--success-11)';
      default:
        return 'var(--neutral-9)';
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
        <Circle className={textClass} fill={textColor} size={12} />
        <span className={cn('text-2 font-medium', textClass)}>{title}</span>
        <span className="text-1 text-neutral-11">{description}</span>
      </div>
    </CardButton>
  );
};
