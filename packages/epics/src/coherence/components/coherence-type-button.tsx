import { CardButton, CardButtonProps } from '../../common/card-button';
import { DynamicIcon, LucideReactIcon } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { CheckIcon, TicketIcon } from 'lucide-react';

export interface CoherenceTypeButtonProps extends CardButtonProps {
  icon: LucideReactIcon;
  onClick: () => void;
}

export const CoherenceTypeButton = ({
  icon,
  title,
  description,
  colorVariant,
  selected,
  className,
  onClick,
}: CoherenceTypeButtonProps) => {
  const textColor = ((variant) => {
    switch (variant) {
      case 'accent':
        return 'text-accent-9';
      case 'error':
        return 'text-error-9';
      case 'warn':
        return 'text-warning-11';
      case 'success':
        return 'text-success-11';
      case 'neutral':
        return 'text-neutral-9';
      case 'tension':
        return 'text-tension-10';
      case 'insight':
        return 'text-insight-9';
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
      <div className="w-full flex flex-row gap-3">
        <div className={cn('h-7 flex items-center', textColor)}>
          <DynamicIcon name={icon} size={16} />
        </div>
        <div className="flex flex-col">
          <span className={cn('text-2 font-medium', textColor)}>{title}</span>
          <span className="text-1 text-neutral-11">
            <span>{description}</span>
          </span>
        </div>
        <div className="ml-auto">
          {selected && <CheckIcon className={cn('h-4 w-4', textColor)} />}
        </div>
      </div>
    </CardButton>
  );
};
