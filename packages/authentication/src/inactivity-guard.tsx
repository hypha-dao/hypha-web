'use client';

import { useRouter } from 'next/navigation';
import { useRef, useCallback, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';

const FIVE_MIN_IN_MS = 300000;

export function InactivityGuard({ maxInactivity = FIVE_MIN_IN_MS }) {
  const { logout } = usePrivy();

  const router = useRouter();
  const timer = useRef<NodeJS.Timeout>(setTimeout(() => {}, 0));

  const onLogout = useCallback(async () => {
    logout();
    router.push('/network');
  }, [router]);

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
