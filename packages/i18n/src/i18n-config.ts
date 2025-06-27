import { HYPHA_LOCALE } from '@hypha-platform/cookie';

export const i18nConfig = {
  defaultLocale: 'en',
  locales: ['en', 'de'],
  prefixDefault: true,
  localeCookie: HYPHA_LOCALE,
} as const;

export type Locale = (typeof i18nConfig)['locales'][number];
