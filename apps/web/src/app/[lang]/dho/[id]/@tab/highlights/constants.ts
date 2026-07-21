import { Locale } from '@hypha-platform/i18n';

export const getDhoPathHighlights = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/highlights`;
};
