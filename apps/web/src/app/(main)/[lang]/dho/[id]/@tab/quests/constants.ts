import { Locale } from '@hypha-platform/i18n';

export const getDhoPathQuests = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/quests`;
};
