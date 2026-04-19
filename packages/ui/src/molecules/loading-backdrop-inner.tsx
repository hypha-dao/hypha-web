'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@hypha-platform/ui-utils';
import { useAsideOverlayLayout } from '../context/aside-overlay-layout';
import { Progress } from '../progress';

type LoadingBackdropInnerPropsBase = {
  children: React.ReactElement;
  isLoading?: boolean;
  progress?: number;
  className?: string;
  message?: React.ReactElement;
  fullHeight?: boolean;
  /** `auto`: follow Aside overlay context (modal shell vs side panel). */
  fullHeightVariant?: 'auto' | 'docked-panel' | 'responsive-modal-shell';
};

/** When `showKeepWindowOpenMessage` is true, localized `keepWindowOpenMessage` is required (no English default in this component). */
export type LoadingBackdropInnerProps =
  | (LoadingBackdropInnerPropsBase & {
      showKeepWindowOpenMessage?: false;
      keepWindowOpenMessage?: undefined;
    })
  | (LoadingBackdropInnerPropsBase & {
      showKeepWindowOpenMessage: true;
      keepWindowOpenMessage: React.ReactNode;
    });

/** Legacy card — docked side panel & inline overlays (unchanged layout). */
function ProgressCard({
  progress,
  showKeepWindowOpenMessage,
  keepWindowOpenMessage,
  message,
  cardClassName,
}: {
  progress: number;
  showKeepWindowOpenMessage: boolean;
  keepWindowOpenMessage: React.ReactNode;
  message?: React.ReactElement;
  cardClassName?: string;
}) {
  return (
    <div
      className={cn(
        'flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-card px-6 py-5 text-card-foreground shadow-lg ring-1 ring-accent-9/12 dark:ring-accent-9/20 md:max-w-lg',
        cardClassName,
      )}
    >
      <Progress
        value={progress}
        className="h-2 w-full bg-muted"
        indicatorColor="bg-accent-9"
      />
      {showKeepWindowOpenMessage && keepWindowOpenMessage ? (
        <p className="text-center text-sm font-medium leading-snug text-foreground">
          {keepWindowOpenMessage}
        </p>
      ) : null}
      <div className="text-center text-sm text-muted-foreground">{message}</div>
    </div>
  );
}

/** Compact glass status — portaled modal-shell overlay (no nested white sheet). */
function ModalShellLoadingStatus({
  progress,
  showKeepWindowOpenMessage,
  keepWindowOpenMessage,
  message,
}: {
  progress: number;
  showKeepWindowOpenMessage: boolean;
  keepWindowOpenMessage: React.ReactNode;
  message?: React.ReactElement;
}) {
  const trackPulse = progress === 0;

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-sm space-y-3 rounded-2xl px-5 py-4',
        'ring-1 ring-border/40 bg-muted/25 backdrop-blur-md',
        'dark:bg-white/5 dark:ring-white/15',
      )}
    >
      <Progress
        value={progress}
        className={cn(
          'h-2 w-full rounded-full bg-muted/70 dark:bg-white/15',
          trackPulse && 'motion-safe:animate-pulse',
        )}
        indicatorColor="bg-accent-9"
      />
      {showKeepWindowOpenMessage && keepWindowOpenMessage ? (
        <p className="text-center text-sm font-semibold leading-snug text-foreground">
          {keepWindowOpenMessage}
        </p>
      ) : null}
      <div className="text-center text-xs leading-relaxed text-muted-foreground">
        {message}
      </div>
    </div>
  );
}

export function LoadingBackdropInner({
  isLoading = false,
  progress = 0,
  children,
  className,
  message,
  showKeepWindowOpenMessage = false,
  keepWindowOpenMessage,
  fullHeight = false,
  fullHeightVariant = 'auto',
}: LoadingBackdropInnerProps) {
  const asideLayout = useAsideOverlayLayout();
  const resolvedFullHeightVariant =
    fullHeightVariant === 'responsive-modal-shell'
      ? 'responsive-modal-shell'
      : fullHeightVariant === 'docked-panel'
      ? 'docked-panel'
      : asideLayout === 'modal-shell'
      ? 'responsive-modal-shell'
      : 'docked-panel';

  const useModalPortal =
    fullHeight &&
    resolvedFullHeightVariant === 'responsive-modal-shell' &&
    isLoading;

  const modalShellOverlayInner = (
    <div
      className={cn(
        'fixed inset-0 z-[45] flex flex-col items-center justify-center p-4 lg:p-8',
        'bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70',
        'dark:bg-black/45 dark:supports-[backdrop-filter]:bg-black/35',
        'max-md:top-[var(--menu-top-height,65px)] max-md:right-[var(--sidebar-right-width,0px)]',
        className,
      )}
      aria-live="polite"
      aria-busy="true"
    >
      <ModalShellLoadingStatus
        progress={progress}
        showKeepWindowOpenMessage={showKeepWindowOpenMessage}
        keepWindowOpenMessage={keepWindowOpenMessage}
        message={message}
      />
    </div>
  );

  const dockedOrInlineOverlay =
    isLoading &&
    !useModalPortal &&
    (fullHeight && resolvedFullHeightVariant === 'docked-panel' ? (
      <div
        className={cn(
          'fixed bottom-0 z-10 flex w-full flex-col items-center justify-center space-y-2 bg-background/75 p-4 md:w-container-sm lg:p-7',
          className,
        )}
        style={{
          top: 'var(--menu-top-height, 65px)',
          right: 'var(--sidebar-right-width, 0px)',
        }}
        aria-live="polite"
        aria-busy="true"
      >
        <ProgressCard
          progress={progress}
          showKeepWindowOpenMessage={showKeepWindowOpenMessage}
          keepWindowOpenMessage={keepWindowOpenMessage}
          message={message}
        />
      </div>
    ) : !fullHeight ? (
      <div
        className={cn(
          'absolute inset-0 z-10 flex min-h-full flex-col items-center justify-center space-y-2 bg-background/75',
          className,
        )}
        aria-live="polite"
        aria-busy="true"
      >
        <ProgressCard
          progress={progress}
          showKeepWindowOpenMessage={showKeepWindowOpenMessage}
          keepWindowOpenMessage={keepWindowOpenMessage}
          message={message}
        />
      </div>
    ) : null);

  const canUseDom = typeof document !== 'undefined';

  return (
    <div className={cn('relative w-full', fullHeight && 'h-full')}>
      {children}
      {useModalPortal && isLoading
        ? canUseDom
          ? createPortal(modalShellOverlayInner, document.body)
          : null
        : dockedOrInlineOverlay}
    </div>
  );
}
