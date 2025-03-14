import { cn } from '@hypha-platform/lib/utils';
import { Progress } from '../progress';
import clsx from 'clsx';

type LoadingBackdrop = {
  children: React.ReactElement;
  isLoading?: boolean;
  progress?: number;
  className?: string;
  message?: string;
};

export const LoadingBackdrop = ({
  isLoading = false,
  progress = 0,
  children,
  className,
  message,
}: LoadingBackdrop) => {
  return isLoading ? (
    <div className="relative h-full w-full">
      {children}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 bottom-0 flex flex-col items-center justify-center space-y-2 bg-background/75',
          className,
        )}
      >
        <Progress value={progress} className="h-2 w-3/4 max-w-md" />
        <div className="text-center text-sm">{message}</div>
      </div>
    </div>
  ) : (
    children
  );
};
