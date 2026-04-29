import { Locale } from '@hypha-platform/i18n';

export const getDhoPathSignals = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/signals`;
};
