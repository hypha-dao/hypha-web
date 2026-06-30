'use client';

import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { useEffect, useState } from 'react';
import { HYPHA_TIMEZONE, getCookie, setCookie } from '@hypha-platform/cookie';
import { getBrowserTimeZone, isValidTimeZone } from '@hypha-platform/ui-utils';

type LocalizedIntlProviderProps = {
  children: React.ReactNode;
  locale: string;
  messages: Record<string, unknown>;
};

const TIMEZONE_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

function resolveClientTimeZone(): string {
  const fromCookie = getCookie(HYPHA_TIMEZONE);
  if (isValidTimeZone(fromCookie)) {
    return fromCookie;
  }

  return getBrowserTimeZone();
}

export function LocalizedIntlProvider({
  children,
  locale,
  messages,
}: LocalizedIntlProviderProps) {
  const [timeZone, setTimeZone] = useState(resolveClientTimeZone);

  useEffect(() => {
    const browserTimeZone = getBrowserTimeZone();
    setTimeZone(browserTimeZone);
    setCookie(
      HYPHA_TIMEZONE,
      browserTimeZone,
      new Date(Date.now() + TIMEZONE_COOKIE_MAX_AGE_MS),
    );
  }, []);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages as AbstractIntlMessages}
      timeZone={timeZone}
    >
      {children}
    </NextIntlClientProvider>
  );
}
