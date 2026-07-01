'use client';

import type { MouseEvent } from 'react';
import { APP_NAV_COUNT_KEY } from './app-navigation-session';

type AsideRouter = {
  back: () => void;
  push: (href: string) => void;
  refresh: () => void;
};

function readAppNavCount(): number {
  if (typeof window === 'undefined') return 0;
  const parsed = Number.parseInt(
    window.sessionStorage.getItem(APP_NAV_COUNT_KEY) ?? '0',
    10,
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function isOverlayChildPath(pathname: string, closeUrl: string): boolean {
  return pathname !== closeUrl && pathname.startsWith(`${closeUrl}/`);
}

/** Close handler for {@link ProposalOverlayShell} aside routes (parallel `@aside` slots). */
export function createAsideOverlayCloseHandler({
  closeUrl,
  pathname,
  router,
}: {
  closeUrl: string;
  pathname: string;
  router: AsideRouter;
}) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (typeof window === 'undefined') return;

    const onOverlayChild = isOverlayChildPath(pathname, closeUrl);
    const appNavCount = readAppNavCount();

    if (onOverlayChild && appNavCount > 0) {
      event.preventDefault();
      router.back();
      return;
    }

    if (onOverlayChild) {
      event.preventDefault();
      router.push(closeUrl);
      return;
    }

    if (pathname === closeUrl) {
      event.preventDefault();
      if (appNavCount > 0) {
        router.back();
      } else {
        router.refresh();
      }
    }
  };
}
