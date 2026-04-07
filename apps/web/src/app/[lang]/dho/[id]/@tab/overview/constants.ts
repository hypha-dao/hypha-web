import { Locale } from '@hypha-platform/i18n';

export const getDhoPathOverview = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/overview`;
};
