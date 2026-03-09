'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { LanguageSelect } from '@hypha-platform/ui';
import {
  routing,
  localeMetadata,
  useRouter,
  usePathname,
} from '@hypha-platform/i18n/client';

export function ConnectedLanguageSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const activeLocale = useLocale();
  const [isPending, startTransition] = useTransition();

  const locales = routing.locales.map((code) => localeMetadata[code]);

  function handleLocaleChange(nextLocale: string) {
    if (nextLocale === activeLocale) return;
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <LanguageSelect
      currentLocale={activeLocale}
      locales={locales}
      onLocaleChange={handleLocaleChange}
    />
  );
}
