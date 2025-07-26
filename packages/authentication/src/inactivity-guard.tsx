'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useRef, useCallback, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useDebouncedCallback } from 'use-debounce';

const THIRTY_MINUTES_IN_MS = 1800000;

/**
 * @brief Component to logout a user after a period of inactivity
 */
export function InactivityGuard({ maxInactivity = THIRTY_MINUTES_IN_MS }) {
  const { logout } = usePrivy();
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(setTimeout(() => {}, 0));

  const onLogout = useCallback(async () => {
    try {
      await logout();
      router.push('/network');
    } catch (e) {
      console.error('Inactivity logout failed:', e);
    }
  }, [router, logout]);

  const onReset = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(onLogout, maxInactivity);
  }, [onLogout, maxInactivity]);

  const debouncedOnReset = useDebouncedCallback(onReset, 100, {
    leading: false,
    trailing: true,
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    debouncedOnReset();

    window.addEventListener('mousemove', debouncedOnReset, { passive: true });
    window.addEventListener('keypress', debouncedOnReset);
    window.addEventListener('keydown', debouncedOnReset);
    document.body.addEventListener('scroll', debouncedOnReset, {
      passive: true,
    });

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }

      window.removeEventListener('mousemove', debouncedOnReset);
      window.removeEventListener('keypress', debouncedOnReset);
      window.removeEventListener('keydown', debouncedOnReset);
      document.body.removeEventListener('scroll', debouncedOnReset);

      debouncedOnReset.cancel();
    };
  }, [debouncedOnReset]);

  return <></>;
}
