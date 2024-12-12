import { FC } from 'react';
import { Button } from '@hypha-platform/ui';

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
    <div className="w-full flex justify-center mb-8">
      <Button
        disabled={disabled || isLoading}
        onClick={onClick}
        className="rounded-lg w-fit mt-4"
        variant="outline"
        size="sm"
      >
        {children}
      </Button>
    </div>
  );
};
