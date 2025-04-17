import { Locale } from '@hypha-platform/i18n';

export const getDhoPathAgreements = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/agreements`;
};
