import { Locale } from '@hypha-platform/i18n';

export const getDhoPathTreasury = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/treasury`;
};
