import { Locale } from '@hypha-platform/i18n';

export const getDhoPathBanking = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/banking`;
};
