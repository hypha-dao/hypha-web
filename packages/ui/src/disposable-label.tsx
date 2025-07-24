import clsx from 'clsx';
import { Button } from './button';
import { Cross2Icon } from '@radix-ui/react-icons';
import { Label } from './label';

export type DisposableLabelProps = {
  className?: string;
  label: string;
  closeTooltip?: string;
  onClose?: React.MouseEventHandler;
};

export const DisposableLabel = ({
  className,
  label,
  closeTooltip,
  onClose,
}: DisposableLabelProps) => {
  return (
    <Label
      key={`disposable-button-${label}`}
      className={clsx(
        'flex flex-row p-1 gap-1 bg-background border-1 rounded-lg',
        className,
      )}
    >
      <Button
        key={`disposable-button-close-${label}`}
        className="w-4 h-4 align-middle"
        variant="ghost"
        colorVariant="neutral"
        size="icon"
        title={closeTooltip}
        aria-label={closeTooltip || `Remove ${label}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose?.(e);
        }}
      >
        <Cross2Icon fontSize={20} />
      </Button>
      <span className="h-[20px] align-middle text-2">{label}</span>
    </Label>
  );
};
