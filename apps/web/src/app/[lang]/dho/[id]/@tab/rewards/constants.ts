import { Locale } from '@hypha-platform/i18n';

export const getDhoPathRewards = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/rewards`;
};
