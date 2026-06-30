'use client';

import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { useEffect, useState } from 'react';
import { HYPHA_TIMEZONE } from '@hypha-platform/cookie';
import { setCookie } from '@hypha-platform/cookie';
import { getBrowserTimeZone } from '@hypha-platform/ui-utils';

type LocalizedIntlProviderProps = {
  children: React.ReactNode;
  locale: string;
  messages: Record<string, unknown>;
  /** Timezone resolved on the server from the persisted cookie, if any. */
  timeZone?: string;
};

const TIMEZONE_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export function LocalizedIntlProvider({
  children,
  locale,
  messages,
  timeZone: serverTimeZone,
}: LocalizedIntlProviderProps) {
  const [timeZone, setTimeZone] = useState(
    () => serverTimeZone ?? getBrowserTimeZone(),
  );

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
