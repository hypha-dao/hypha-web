import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'pt', 'es', 'fr', 'de', 'mk'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];
