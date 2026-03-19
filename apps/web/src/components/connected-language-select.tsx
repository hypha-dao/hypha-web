'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { LanguageSelect } from '@hypha-platform/ui';
import { routing, localeMetadata } from '@hypha-platform/i18n/client';

export function ConnectedLanguageSelect() {
  const pathname = usePathname();
  const activeLocale = useLocale();
  const tNav = useTranslations('Navigation');

  const locales = routing.locales.map((code) => localeMetadata[code]);

  function handleLocaleChange(nextLocale: string) {
    if (nextLocale === activeLocale) return;

    // Swap only the leading /<locale> segment and do a full navigation
    // so the middleware processes the request and sets the NEXT_LOCALE cookie
    const newPathname = pathname.replace(
      new RegExp(`^/${activeLocale}(?=/|$)`),
      `/${nextLocale}`,
    );

    window.location.href = newPathname;
  }

  return (
    <LanguageSelect
      currentLocale={activeLocale}
      locales={locales}
      onLocaleChange={handleLocaleChange}
      ariaLabel={tNav('selectLanguage')}
    />
  );
}
