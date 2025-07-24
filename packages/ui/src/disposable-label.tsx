import clsx from 'clsx';
import { Button } from './button';
import { Cross2Icon } from '@radix-ui/react-icons';
import { Label } from './label';

export type DisposableButtonProps = {
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
}: DisposableButtonProps) => {
  return (
    <Label
      key={`disposable-button-${label}`}
      className={clsx('flex flex-row gap-1 bg-background border-1 rounded-lg', className)}
    >
      <Button
        key={`disposable-button-close-${label}`}
        className="m-1 mr-0 w-4 h-4"
        variant="ghost"
        colorVariant="neutral"
        size="icon"
        title={closeTooltip}
        onClick={(e) => {
          onClose?.(e);
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <Cross2Icon />
      </Button>
      <span className='m-1 ml-0 align-middle'>{label}</span>
    </Label>
  );
};
