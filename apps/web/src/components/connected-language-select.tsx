'use client';

import { useRouter, usePathname, useParams } from 'next/navigation';
import { LanguageSelect } from '@hypha-platform/ui';
import { i18nConfig, localeMetadata } from '@hypha-platform/i18n/client';
import { setCookie, HYPHA_LOCALE } from '@hypha-platform/cookie';

export function ConnectedLanguageSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const { lang } = useParams<{ lang: string }>();

  const currentLocale = lang ?? i18nConfig.defaultLocale;

  const locales = i18nConfig.locales.map((code) => localeMetadata[code]);

  const handleLocaleChange = (newLocale: string) => {
    if (newLocale === currentLocale) return;

    // Persist locale preference with 1-year expiry (R3.2, R3.3)
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    setCookie(HYPHA_LOCALE, newLocale, expires);

    // Replace only the leading locale segment to avoid corrupting paths
    // that may contain the locale string elsewhere (e.g. /en/dho/en-dao)
    const newPathname =
      '/' + newLocale + pathname.slice(currentLocale.length + 1);
    router.push(newPathname);
  };

  return (
    <LanguageSelect
      currentLocale={currentLocale}
      locales={locales}
      onLocaleChange={handleLocaleChange}
    />
  );
}
