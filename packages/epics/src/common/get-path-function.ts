'use client';

import { Locale } from '@hypha-platform/i18n';

export const getDhoPathAgreements = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/agreements`;
};

export const getDhoUrlAgreements = (lang: Locale, id: string) => {
  const protocol = window.location.protocol;
  const host = window.location.host;
  return `${protocol}//${host}/${lang}/dho/${id}/agreements`;
};

export const getProposalPath = (
  lang: Locale,
  spaceSlug: string,
  proposalSlug: string,
) => {
  return `/${lang}/dho/${spaceSlug}/agreements/proposal/${proposalSlug}`;
};

export type SpaceChatRoom = 'space' | 'ecosystem' | 'public';

/**
 * Space dashboard with the human-chat panel on a channel room
 * (member space, ecosystem, or public).
 */
export const getSpaceChatPath = (
  lang: Locale,
  spaceSlug: string,
  room: SpaceChatRoom = 'space',
) => {
  return `/${lang}/dho/${spaceSlug}/overview?spaceChat=${room}`;
};

export const getSignalPath = (
  lang: Locale,
  spaceSlug: string,
  signalSlug: string,
) => {
  // Land on the space dashboard and open that signal's chat. `/coherence?signal=`
  // was ignored (and redirected away when Coherence is off), so notification
  // and card links looked dead. Bare `/dho/{slug}?signal=` also skips the
  // overview tab slot.
  return `/${lang}/dho/${spaceSlug}/overview?signal=${encodeURIComponent(
    signalSlug,
  )}`;
};

export const getProposalUrl = (
  lang: Locale,
  spaceSlug: string,
  proposalSlug: string,
) => {
  const protocol = window.location.protocol;
  const host = window.location.host;
  return `${protocol}//${host}/${lang}/dho/${spaceSlug}/agreements/proposal/${proposalSlug}`;
};

export const getDhoPathOverview = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/overview`;
};

export const getDhoPathEnergy = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/energy`;
};

/** Default tab when opening a space from lists, maps, or bare `/dho/[slug]` URLs. */
export const getDhoPathDefaultLanding = getDhoPathOverview;

export const getOnboardingPath = (lang: Locale) => {
  return `/${lang}/interactive-create`;
};

/** The create-a-space screen, including the old /onboarding address. */
export const isInteractiveCreatePath = (pathname: string) => {
  return /(^|\/)(interactive-create|onboarding)(\/|$)/.test(pathname);
};

export const getLegacyCreateSpacePath = (lang: Locale) => {
  return `/${lang}/my-spaces/create`;
};
