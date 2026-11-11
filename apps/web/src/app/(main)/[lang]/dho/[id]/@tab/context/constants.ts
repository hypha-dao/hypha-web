import { Locale } from '@hypha-platform/i18n';

export const getDhoPathContext = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/context`;
};
