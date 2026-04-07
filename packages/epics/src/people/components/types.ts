import { Locale } from '@hypha-platform/i18n';

export type ProfileRouteParams = {
  personSlug: string;
};

export type ProfilePageParams = {
  lang: Locale;
  personSlug: string;
};

export type MemberPageParams = {
  id: string;
  lang: Locale;
  personSlug: string;
};

export type ProfileComponentParams = {
  id: string;
  lang: Locale;
  personSlug: string;
};
