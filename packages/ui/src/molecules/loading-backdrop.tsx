import { cn } from '@hypha-platform/ui-utils';
import { Progress } from '../progress';

type LoadingBackdrop = {
  children: React.ReactElement;
  isLoading?: boolean;
  progress?: number;
  className?: string;
  message?: React.ReactElement;
  showKeepWindowOpenMessage?: boolean;
  fullHeight?: boolean;
};

export const LoadingBackdrop = ({
  isLoading = false,
  progress = 0,
  children,
  className,
  message,
  showKeepWindowOpenMessage = false,
  fullHeight = false,
}: LoadingBackdrop) => {
  return (
    <div className={cn('relative w-full', fullHeight && 'h-full')}>
      {children}
      {isLoading && (
        <div
          className={cn(
            fullHeight
              ? 'fixed top-9 bottom-0 right-0 flex flex-col items-center justify-center space-y-2 bg-background/75 z-10 w-full md:w-container-sm p-4 lg:p-7'
              : 'absolute inset-0 flex flex-col items-center justify-center space-y-2 bg-background/75 z-10 min-h-full',
            className,
          )}
        >
          <Progress value={progress} className="h-2 w-3/4 max-w-md" />
          {showKeepWindowOpenMessage && (
            <div className="text-center text-sm font-medium">
              Please keep this window open until the progress bar completes.
            </div>
          )}
          <div className="text-center text-sm">{message}</div>
        </div>
      )}
    </div>
  );
};
