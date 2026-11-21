'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { Fetcher, Middleware } from 'swr';
import {
  createStaleDeployment,
  createWorkInProgressTracker,
  type StaleDeploymentStatus,
} from './stale-deployment';

/** What a reload would lose: typed input, plus opted-in checks (calls, ...). */
export const workInProgress = createWorkInProgressTracker();

/** The tab's single stale-deployment state, shared by SWR and the notice. */
export const staleDeployment = createStaleDeployment({
  getStorage: () => window.sessionStorage,
  isWorkInProgress: () => workInProgress.isActive(),
  reload: () => window.location.reload(),
});

/**
 * SWR middleware: once the tab is stale, fetchers reject with the same error
 * without sending a request, so polling and focus refreshes stop hitting 404.
 */
export const createStaleDeploymentSWRMiddleware =
  (instance: Pick<typeof staleDeployment, 'wrapFetcher'>): Middleware =>
  (useSWRNext) =>
  (key, fetcher, config) =>
    useSWRNext(
      key,
      fetcher
        ? instance.wrapFetcher(fetcher as Fetcher<unknown, never>)
        : fetcher,
      config,
    );

export const staleDeploymentSWRMiddleware =
  createStaleDeploymentSWRMiddleware(staleDeployment);

export function useStaleDeploymentStatus(): StaleDeploymentStatus {
  return useSyncExternalStore(
    staleDeployment.subscribe,
    staleDeployment.getStatus,
    () => 'idle',
  );
}

/**
 * Opt-in: while `active` is true a stale tab shows the refresh banner instead
 * of reloading by itself. For work the global input detection cannot see.
 */
export function useBlockAutoReload(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const remove = workInProgress.addProbe(() => true);
    syncUnloadGuard();
    return () => {
      remove();
      syncUnloadGuard();
    };
  }, [active]);
}

let unloadGuard: ((event: BeforeUnloadEvent) => void) | null = null;

function setUnloadGuard(enabled: boolean) {
  if (enabled && !unloadGuard) {
    unloadGuard = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', unloadGuard);
  } else if (!enabled && unloadGuard) {
    window.removeEventListener('beforeunload', unloadGuard);
    unloadGuard = null;
  }
}

/**
 * The leave prompt is on while the tab is stale (banner state) and work is in
 * progress. It follows that state, not whether the notice is visible, so it
 * stays on after the user dismisses the notice.
 */
function syncUnloadGuard() {
  setUnloadGuard(
    staleDeployment.getStatus() === 'banner' && workInProgress.isActive(),
  );
}

/** Reload from the banner's button: the user already chose, do not ask again. */
export function refreshNow(): void {
  setUnloadGuard(false);
  window.location.reload();
}

/**
 * Browser wiring, installed once by the notice component:
 *  - direct Server Action calls that fail outside SWR (unhandled rejections);
 *  - user input tracking (passive, never blocks typing);
 *  - the browser's own leave prompt, only while the tab is stale (banner
 *    state, even if the notice was dismissed) and work is in progress, so
 *    normal navigation and tab closing are untouched.
 */
export function installStaleDeploymentListeners(): () => void {
  const onRejection = (event: PromiseRejectionEvent) => {
    staleDeployment.handleError(event.reason);
  };
  const onUserInput = (event: Event) => {
    if (!event.isTrusted) return;
    workInProgress.markUserInput();
    // Typing after the banner is already up must switch the leave prompt on.
    syncUnloadGuard();
  };

  window.addEventListener('unhandledrejection', onRejection);
  const inputOptions = { capture: true, passive: true } as const;
  document.addEventListener('input', onUserInput, inputOptions);
  document.addEventListener('change', onUserInput, inputOptions);
  const unsubscribe = staleDeployment.subscribe(syncUnloadGuard);
  syncUnloadGuard();

  return () => {
    window.removeEventListener('unhandledrejection', onRejection);
    document.removeEventListener('input', onUserInput, inputOptions);
    document.removeEventListener('change', onUserInput, inputOptions);
    unsubscribe();
    setUnloadGuard(false);
  };
}
