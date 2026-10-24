'use client';

/** TEMP(#2575): diagnostics only, remove with the fix. */
import { useRef } from 'react';

/** Logs which dependencies changed identity between renders, and how often the owner renders. */
export function useWhatChanged2575(
  name: string,
  deps: Record<string, unknown>,
) {
  const previous = useRef<Record<string, unknown> | null>(null);
  const renders = useRef(0);
  renders.current += 1;
  const changed: string[] = [];
  if (previous.current) {
    for (const key of Object.keys(deps)) {
      if (!Object.is(previous.current[key], deps[key])) changed.push(key);
    }
  }
  if (changed.length > 0) {
    console.log(`[#2575] ${name} deps changed`, {
      render: renders.current,
      changed,
    });
  }
  previous.current = deps;
}

let effectRuns = 0;
/** Counts how often an effect body runs. */
export function logEffectRun2575(
  name: string,
  extra?: Record<string, unknown>,
) {
  effectRuns += 1;
  console.log(`[#2575] ${name} effect run #${effectRuns}`, {
    href: typeof window !== 'undefined' ? window.location.href : null,
    ...extra,
  });
}

/** Logs every history.pushState/replaceState with a short caller stack. Returns an uninstall. */
export function installHistoryTrace2575(): () => void {
  const originalPush = window.history.pushState.bind(window.history);
  const originalReplace = window.history.replaceState.bind(window.history);
  let count = 0;
  const trace = (kind: string, url: unknown) => {
    count += 1;
    const stack = (new Error().stack ?? '')
      .split('\n')
      .slice(3, 10)
      .join(' | ');
    console.log(`[#2575] history.${kind} #${count} ${String(url)} | ${stack}`);
  };
  window.history.pushState = (data, unused, url) => {
    trace('pushState', url);
    return originalPush(data, unused, url);
  };
  window.history.replaceState = (data, unused, url) => {
    trace('replaceState', url);
    return originalReplace(data, unused, url);
  };
  const originalFetch = window.fetch.bind(window);
  let serverActionCalls = 0;
  window.fetch = async (input, init) => {
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    const actionId = headers.get('next-action');
    const url0 = input instanceof Request ? input.url : String(input);
    if (!actionId && (headers.get('rsc') || url0.includes('_rsc='))) {
      const kind = headers.get('next-router-prefetch') ? 'prefetch' : 'rsc';
      const response = await originalFetch(input, init);
      console.log(
        `[#2575] ${kind} fetch ${url0} -> ${response.status} redirected=${response.redirected} final=${response.url}`,
      );
      return response;
    }
    if (!actionId) return originalFetch(input, init);
    serverActionCalls += 1;
    const n = serverActionCalls;
    const stack = (new Error().stack ?? '').split('\n').slice(2, 7).join(' | ');
    const url = input instanceof Request ? input.url : String(input);
    try {
      const response = await originalFetch(input, init);
      console.log(`[#2575] server action #${n}`, {
        actionId,
        url,
        status: response.status,
        stack,
      });
      return response;
    } catch (error) {
      console.log(`[#2575] server action #${n} threw`, {
        actionId,
        url,
        error,
      });
      throw error;
    }
  };
  return () => {
    window.history.pushState = originalPush;
    window.history.replaceState = originalReplace;
    window.fetch = originalFetch;
  };
}
