import { cn } from '@hypha-platform/lib/utils';
import { Progress } from '../progress';

type LoadingBackdrop = {
  children: React.ReactElement;
  isLoading?: boolean;
  progress?: number;
  className?: string;
  message?: React.ReactElement;
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
          'absolute inset-0 flex flex-col items-center justify-center space-y-2 bg-background/75 z-10',
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
