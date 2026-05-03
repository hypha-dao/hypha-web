'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const TIME_ZONE_COOKIE = 'hypha-timezone';
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }

  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`));

  return match
    ? decodeURIComponent(match.split('=').slice(1).join('='))
    : undefined;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(
    value,
  )}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; samesite=lax`;
}

export function TimeZoneSync() {
  const router = useRouter();

  useEffect(() => {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTimeZone) {
      return;
    }

    const currentTimeZone = readCookie(TIME_ZONE_COOKIE);
    if (currentTimeZone === browserTimeZone) {
      return;
    }

    writeCookie(TIME_ZONE_COOKIE, browserTimeZone);
    router.refresh();
  }, [router]);

  return null;
}
