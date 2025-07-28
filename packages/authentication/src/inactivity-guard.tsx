'use client';

import { useRouter } from 'next/navigation';
import { useRef, useCallback, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';

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
      logout();
      router.push('/network');
    } catch (e) {
      console.error('Inactivity logout failed:', e);
    }
  }, [router, logout]);

  const onReset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(onLogout, maxInactivity);
  }, [onLogout, maxInactivity]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    onReset();

    window.addEventListener('mousemove', onReset);
    window.addEventListener('keypress', onReset);
    window.addEventListener('keydown', onReset);
    window.addEventListener('scroll', onReset);

    return () => {
      if (timer.current) clearTimeout(timer.current);

      window.removeEventListener('mousemove', onReset);
      window.removeEventListener('keypress', onReset);
      window.removeEventListener('keydown', onReset);
      window.removeEventListener('scroll', onReset);
    };
  }, [onReset]);

  return <></>;
}
