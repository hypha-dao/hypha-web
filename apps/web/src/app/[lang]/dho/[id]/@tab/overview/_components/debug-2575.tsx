'use client';

/** TEMP(#2575): diagnostics only, remove with the fix. */
import {
  Component,
  Profiler,
  useEffect,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { useRouter, useSelectedLayoutSegment } from 'next/navigation';
import { installHistoryTrace2575 } from '@hypha-platform/epics';

function navigationType() {
  const entry = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  return entry?.type ?? null;
}

const UNLOAD_KEY = '2575:unload';

export function Debug2575Lifecycle({ name }: { name: string }) {
  const router = useRouter();

  // Wrap the shared app-router object so every router.* call is logged with its caller.
  useEffect(() => {
    const target = router as unknown as Record<string, unknown>;
    const originals = new Map<string, unknown>();
    let count = 0;
    for (const method of [
      'push',
      'replace',
      'refresh',
      'prefetch',
      'back',
      'forward',
    ]) {
      const original = target[method];
      if (typeof original !== 'function') continue;
      originals.set(method, original);
      target[method] = (...args: unknown[]) => {
        count += 1;
        const stack = (new Error().stack ?? '')
          .split('\n')
          .slice(2, 9)
          .join(' | ');
        const fromRedirectBoundary =
          method === 'replace' &&
          stack.includes('startTransition') &&
          JSON.stringify(args[1] ?? null) === '{}';
        console.log(
          `[#2575] router.${method} #${count}${
            fromRedirectBoundary
              ? ' [REDIRECT-BOUNDARY: server redirect()]'
              : ''
          } -> ${JSON.stringify(args[0])} ${JSON.stringify(
            args[1] ?? null,
          )} | ${stack}`,
        );
        return (original as (...a: unknown[]) => unknown)(...args);
      };
    }
    return () => {
      for (const [method, original] of originals) target[method] = original;
    };
  }, [router]);

  // Why does the document reload? Record navigations and what the previous document saw last.
  useEffect(() => {
    try {
      const previous = window.sessionStorage.getItem(UNLOAD_KEY);
      if (previous) {
        console.log('[#2575] previous document unloaded', JSON.parse(previous));
        window.sessionStorage.removeItem(UNLOAD_KEY);
      }
    } catch {
      /* storage unavailable */
    }
    const onPageHide = (event: PageTransitionEvent) => {
      try {
        window.sessionStorage.setItem(
          UNLOAD_KEY,
          JSON.stringify({
            at: new Date().toISOString(),
            href: window.location.href,
            persisted: event.persisted,
          }),
        );
      } catch {
        /* storage unavailable */
      }
    };
    const onPopState = () =>
      console.log('[#2575] popstate', { href: window.location.href });
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('popstate', onPopState);
    const nav = (
      window as unknown as {
        navigation?: EventTarget & {
          addEventListener: (type: string, cb: (e: any) => void) => void;
        };
      }
    ).navigation;
    const onNavigate = (event: any) =>
      console.log('[#2575] navigation api', {
        to: event.destination?.url,
        type: event.navigationType,
        userInitiated: event.userInitiated,
        sameDocument: event.destination?.sameDocument,
      });
    nav?.addEventListener('navigate', onNavigate);
    const removeNav = () =>
      (
        nav as unknown as {
          removeEventListener?: (type: string, cb: (e: any) => void) => void;
        }
      )?.removeEventListener?.('navigate', onNavigate);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('popstate', onPopState);
      removeNav();
    };
  }, []);

  useEffect(() => {
    console.log(`[#2575] ${name} mounted`, {
      href: window.location.href,
      referrer: document.referrer,
      navigationType: navigationType(),
      visibility: document.visibilityState,
      historyLength: window.history.length,
    });
    const onError = (event: ErrorEvent) =>
      console.error(`[#2575] window error (${name})`, {
        message: event.message,
        stack: event.error?.stack,
      });
    window.addEventListener('error', onError);
    const uninstallHistoryTrace = installHistoryTrace2575();
    // Heap + long-task sampling, to tell a CPU-bound loop from a memory leak before a tab crash.
    const heapTimer = window.setInterval(() => {
      const memory = (
        performance as unknown as {
          memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
        }
      ).memory;
      if (memory) {
        console.log('[#2575] heap', {
          usedMB: Math.round(memory.usedJSHeapSize / 1048576),
          limitMB: Math.round(memory.jsHeapSizeLimit / 1048576),
        });
      }
    }, 2000);
    let longTasks: PerformanceObserver | null = null;
    try {
      longTasks = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.log('[#2575] long task', { ms: Math.round(entry.duration) });
        }
      });
      longTasks.observe({ entryTypes: ['longtask'] });
    } catch {
      longTasks = null;
    }
    return () => {
      window.clearInterval(heapTimer);
      longTasks?.disconnect();
      uninstallHistoryTrace();
      window.removeEventListener('error', onError);
      console.log(`[#2575] ${name} unmounted`, {
        href: window.location.href,
      });
    };
  }, [name]);
  return null;
}

export class Debug2575Boundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[#2575] render error caught', {
      message: error.message,
      href: window.location.href,
      componentStack: info.componentStack,
    });
    // Re-throw so the route's error.tsx still renders as before.
    throw error;
  }

  render() {
    return this.props.children;
  }
}

/** Logs which page each layout slot holds. `children` non-null means dho/[id]/page.tsx (the redirecting page) is active. */
export function Debug2575Slots() {
  const children = useSelectedLayoutSegment('children');
  const tab = useSelectedLayoutSegment('tab');
  const aside = useSelectedLayoutSegment('aside');
  useEffect(() => {
    console.log('[#2575] layout slots', {
      children,
      tab,
      aside,
      href: window.location.href,
    });
  }, [children, tab, aside]);
  return null;
}

let commits = 0;
/** Counts commits of the wrapped subtree; logs each one with its phase. */
export function Debug2575Profiler({ children }: { children: ReactNode }) {
  return (
    <Profiler
      id="overview-2575"
      onRender={(_id, phase, actualDuration) => {
        commits += 1;
        console.log('[#2575] overview commit', {
          n: commits,
          phase,
          ms: Math.round(actualDuration),
        });
      }}
    >
      {children}
    </Profiler>
  );
}
