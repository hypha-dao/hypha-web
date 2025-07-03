import { FC } from 'react';
import { Button } from '../button';

type SectionLoadMoreProps = {
  onClick: () => void;
  children?: React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
};

export const SectionLoadMore: FC<SectionLoadMoreProps> = ({
  onClick,
  children,
  isLoading,
  disabled,
}) => {
  return (
    <div className="w-full flex justify-center">
      <Button
        disabled={disabled || isLoading}
        onClick={onClick}
        className="rounded-lg w-fit"
        variant="outline"
        colorVariant="neutral"
      >
        {children}
      </Button>
    </div>
  );
};
