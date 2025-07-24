import clsx from 'clsx';
import { Button } from './button';
import { Cross2Icon } from '@radix-ui/react-icons';

export type DisposableButtonProps = {
  classNames?: string;
  label: string;
  onClick?: React.MouseEventHandler;
  onClose?: React.MouseEventHandler;
};

export const DisposableButton = ({
  classNames,
  label,
  onClick,
  onClose,
}: DisposableButtonProps) => {
  return (
    <Button
      key={`disposable-button-${label}`}
      variant="outline"
      colorVariant="neutral"
      className={clsx('ml-0', classNames)}
      onClick={onClick}
    >
      <Button
        key={`disposable-button-close-${label}`}
        className="m-0 w-4 h-4"
        variant="ghost"
        colorVariant="neutral"
        size="icon"
        onClick={(e) => {
          onClose?.(e);
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <Cross2Icon />
      </Button>
      <span>{label}</span>
    </Button>
  );
};
