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
