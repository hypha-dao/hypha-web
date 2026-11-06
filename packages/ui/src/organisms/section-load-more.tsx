'use client';

import { useEffect, useRef, type FC, type ReactNode } from 'react';
import { Button } from '../button';

type SectionLoadMoreProps = {
  onClick: () => void;
  children?: ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  /**
   * When true (default), intersecting this footer loads the next page.
   * Set false to keep the legacy outline button.
   */
  autoLoad?: boolean;
};

function sentinelInLoadRange(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const viewport = window.visualViewport?.height ?? window.innerHeight ?? 0;
  return rect.top <= viewport + 240;
}

/**
 * Section footer for paginated card grids (proposals, members, spaces, …).
 * Default behaviour: load the next page when the footer scrolls into view.
 */
export const SectionLoadMore: FC<SectionLoadMoreProps> = ({
  onClick,
  children,
  isLoading = false,
  disabled = false,
  autoLoad = true,
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onClickRef = useRef(onClick);
  const disabledRef = useRef(disabled);
  const isLoadingRef = useRef(isLoading);
  const loadLockRef = useRef(false);
  onClickRef.current = onClick;
  disabledRef.current = disabled;
  isLoadingRef.current = isLoading;

  useEffect(() => {
    if (!autoLoad) return;
    const el = sentinelRef.current;
    if (!el) return;

    let cancelled = false;

    const requestLoad = () => {
      if (cancelled || disabledRef.current || isLoadingRef.current) return;
      if (loadLockRef.current) return;
      loadLockRef.current = true;
      onClickRef.current();
      // Sync page bumps often keep `isLoading` false, and IntersectionObserver
      // will not re-fire while the sentinel stays on screen — release after
      // paint and keep filling the viewport one page at a time.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          loadLockRef.current = false;
          if (cancelled || disabledRef.current || isLoadingRef.current) return;
          if (sentinelInLoadRange(el)) {
            requestLoad();
          }
        });
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          requestLoad();
        }
      },
      { root: null, rootMargin: '240px 0px', threshold: 0 },
    );
    io.observe(el);
    requestLoad();

    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [autoLoad]);

  // Async fetchers flip `isLoading` true → false without leaving the viewport.
  useEffect(() => {
    if (!autoLoad || disabled || isLoading) return;
    const el = sentinelRef.current;
    if (!el || !sentinelInLoadRange(el) || loadLockRef.current) return;
    loadLockRef.current = true;
    onClick();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        loadLockRef.current = false;
      });
    });
  }, [autoLoad, disabled, isLoading, onClick]);

  if (!autoLoad) {
    return (
      <div className="flex w-full justify-center">
        <Button
          disabled={disabled || isLoading}
          onClick={onClick}
          className="w-fit rounded-lg"
          variant="outline"
          colorVariant="neutral"
        >
          {children}
        </Button>
      </div>
    );
  }

  const exhausted = disabled && !isLoading;

  return (
    <div
      ref={sentinelRef}
      className="flex min-h-8 w-full items-center justify-center py-3 text-sm text-muted-foreground"
      aria-live="polite"
      data-testid={
        exhausted ? 'section-load-more-exhausted' : 'section-load-more-sentinel'
      }
    >
      {exhausted || isLoading ? (
        children
      ) : (
        <span className="sr-only">{children}</span>
      )}
    </div>
  );
};
