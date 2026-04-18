'use client';

import { cn } from '@hypha-platform/ui-utils';
import { useAsideOverlayLayout } from '../context/aside-overlay-layout';
import { Progress } from '../progress';

export type LoadingBackdropInnerProps = {
  children: React.ReactElement;
  isLoading?: boolean;
  progress?: number;
  className?: string;
  message?: React.ReactElement;
  showKeepWindowOpenMessage?: boolean;
  keepWindowOpenMessage?: React.ReactNode;
  fullHeight?: boolean;
  fullHeightVariant?: 'docked-panel' | 'responsive-modal-shell';
};

export function LoadingBackdropInner({
  isLoading = false,
  progress = 0,
  children,
  className,
  message,
  showKeepWindowOpenMessage = false,
  keepWindowOpenMessage = 'Please keep this window open until the progress bar completes.',
  fullHeight = false,
  fullHeightVariant = 'docked-panel',
}: LoadingBackdropInnerProps) {
  const asideLayout = useAsideOverlayLayout();
  const resolvedFullHeightVariant =
    fullHeightVariant === 'responsive-modal-shell'
      ? 'responsive-modal-shell'
      : asideLayout === 'modal-shell'
      ? 'responsive-modal-shell'
      : 'docked-panel';

  return (
    <div className={cn('relative w-full', fullHeight && 'h-full')}>
      {children}
      {isLoading && (
        <div
          className={cn(
            fullHeight &&
              resolvedFullHeightVariant === 'docked-panel' &&
              'fixed bottom-0 flex flex-col items-center justify-center space-y-2 bg-background/75 z-10 w-full md:w-container-sm p-4 lg:p-7',
            fullHeight &&
              resolvedFullHeightVariant === 'responsive-modal-shell' &&
              'z-[15] flex flex-col items-center justify-center space-y-2 bg-background/75 p-4 lg:p-7 max-md:fixed max-md:bottom-0 max-md:left-0 max-md:w-full max-md:top-[var(--menu-top-height,65px)] max-md:right-[var(--sidebar-right-width,0px)] md:fixed md:inset-0',
            !fullHeight &&
              'absolute inset-0 flex flex-col items-center justify-center space-y-2 bg-background/75 z-10 min-h-full',
            className,
          )}
          style={
            fullHeight && resolvedFullHeightVariant === 'docked-panel'
              ? {
                  top: 'var(--menu-top-height, 65px)',
                  right: 'var(--sidebar-right-width, 0px)',
                }
              : undefined
          }
        >
          <Progress value={progress} className="h-2 w-3/4 max-w-md" />
          {showKeepWindowOpenMessage && (
            <div className="text-center text-sm font-medium">
              {keepWindowOpenMessage}
            </div>
          )}
          <div className="text-center text-sm">{message}</div>
        </div>
      )}
    </div>
  );
}
