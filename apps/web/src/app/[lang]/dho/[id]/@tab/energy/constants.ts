import { Locale } from '@hypha-platform/i18n';

export const getDhoPathEnergy = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/energy`;
};
