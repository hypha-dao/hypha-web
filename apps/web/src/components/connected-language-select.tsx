'use client';

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { LanguageSelect } from '@hypha-platform/ui';
import { routing, localeMetadata } from '@hypha-platform/i18n/client';

function localeFromPathname(pathname: string): string | null {
  const first = pathname.split('/').filter(Boolean)[0];
  if (!first) return null;
  return routing.locales.includes(first as (typeof routing.locales)[number])
    ? first
    : null;
}

type ConnectedLanguageSelectProps = {
  selectLanguageLabel: string;
};

export function ConnectedLanguageSelect({
  selectLanguageLabel,
}: ConnectedLanguageSelectProps) {
  const pathname = usePathname();
  const intlLocale = useLocale();

  const pathLocale = useMemo(() => localeFromPathname(pathname), [pathname]);
  const urlLocale = pathLocale ?? intlLocale;

  const [pendingLocale, setPendingLocale] = useState<string | null>(null);

  useEffect(() => {
    if (pendingLocale != null && pathLocale === pendingLocale) {
      setPendingLocale(null);
    }
  }, [pathLocale, pendingLocale]);

  const activeLocale = pendingLocale ?? urlLocale;

  const locales = routing.locales.map((code) => localeMetadata[code]);

  function handleLocaleChange(nextLocale: string) {
    if (nextLocale === urlLocale) return;

    setPendingLocale(nextLocale);

    // Swap only the leading /<locale> segment and do a full navigation
    // so the middleware processes the request and sets the NEXT_LOCALE cookie
    const newPathname = pathname.replace(
      new RegExp(`^/${urlLocale}(?=/|$)`),
      `/${nextLocale}`,
    );

    window.location.href = newPathname;
  }

  return (
    <LanguageSelect
      currentLocale={activeLocale}
      locales={locales}
      onLocaleChange={handleLocaleChange}
      ariaLabel={selectLanguageLabel}
    />
  );
}
