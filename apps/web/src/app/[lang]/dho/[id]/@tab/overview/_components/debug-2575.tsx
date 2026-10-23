'use client';

/** TEMP(#2575): diagnostics only, remove with the fix. */
import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';

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
    return () => {
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
