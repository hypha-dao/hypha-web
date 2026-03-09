import type { Locale } from './i18n-config';

export type LocaleMetadata = {
  code: Locale;
  label: string;
  shortLabel: string;
};

export const localeMetadata: Record<Locale, LocaleMetadata> = {
  en: { code: 'en', label: 'English', shortLabel: 'EN' },
  de: { code: 'de', label: 'Deutsch', shortLabel: 'DE' },
};
