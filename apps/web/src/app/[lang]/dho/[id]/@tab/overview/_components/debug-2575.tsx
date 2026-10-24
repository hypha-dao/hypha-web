'use client';

/** TEMP(#2575): diagnostics only, remove with the fix. */
import {
  Component,
  Profiler,
  useEffect,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { installHistoryTrace2575 } from '@hypha-platform/epics';

function navigationType() {
  const entry = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  return entry?.type ?? null;
}

export function Debug2575Lifecycle({ name }: { name: string }) {
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
