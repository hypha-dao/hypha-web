'use client';

import React from 'react';
import { useAuthentication } from './use-authentication';

/**
 * Privy can report `authenticated` before `getAccessToken()` returns a Bearer
 * token. Network/Org/Space-gated APIs 401 without that token; if a fetch runs
 * then, SWR can cache the failure and never retry.
 *
 * Wait until auth has finished hydrating and (when authenticated) a token is
 * available before kicking off protected fetches.
 */
export function useAccessTokenReady() {
  const {
    getAccessToken,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuthentication();
  const [accessTokenReady, setAccessTokenReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    if (isAuthLoading) {
      setAccessTokenReady(false);
      return;
    }

    if (!isAuthenticated) {
      setAccessTokenReady(true);
      return;
    }

    setAccessTokenReady(false);
    void (async () => {
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          const token = await getAccessToken();
          if (cancelled) return;
          if (token) {
            setAccessTokenReady(true);
            return;
          }
        } catch {
          // Privy may reject during refresh; keep retrying with backoff.
          if (cancelled) return;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, 150 * (attempt + 1)),
        );
      }
      if (!cancelled) {
        // Proceed so callers can surface a real error instead of spinning.
        setAccessTokenReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated, getAccessToken]);

  return {
    getAccessToken,
    isAuthenticated,
    isAuthLoading,
    accessTokenReady,
  };
}
