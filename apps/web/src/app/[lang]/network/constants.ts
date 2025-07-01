import { Locale } from '@hypha-platform/i18n';

export const getDhoPathNetwork = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/network`;
};
