import { Locale } from '@hypha-platform/i18n';

export const Paths = {
  dho: {
    base: (lang: Locale, id: string) => `${lang}/dho/${id}`,

    agreements: (lang: Locale, id: string) =>
      `${Paths.dho.base(lang, id)}/agreements`,

    treasury: (lang: Locale, id: string) =>
      `${Paths.dho.base(lang, id)}/treasury`,

    membership: (lang: Locale, id: string) =>
      `${Paths.dho.base(lang, id)}/membership`,

    networks: (lang: Locale, id: string) =>
      `${Paths.dho.base(lang, id)}/networks`,

    wallet: (lang: Locale, id: string) => `${Paths.dho.base(lang, id)}/wallet`,
  },
};
