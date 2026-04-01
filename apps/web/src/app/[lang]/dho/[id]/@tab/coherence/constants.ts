import { Locale } from '@hypha-platform/i18n';

export const getDhoPathCoherence = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/coherence`;
};
