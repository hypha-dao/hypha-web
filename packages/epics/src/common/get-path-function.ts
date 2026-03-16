'use client';

import { Locale } from '@hypha-platform/i18n';

export type BreadcrumbOrigin = 'network' | 'profile' | 'my-spaces';

export const getDhoPathAgreements = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/agreements`;
};

/**
 * Builds the from query string for breadcrumb origin tracking.
 * Used when linking to spaces from Network, Profile, or My Spaces.
 */
export function getFromQueryString(
  origin: BreadcrumbOrigin,
  profileSlug?: string,
): string {
  if (origin === 'profile' && profileSlug) {
    return `from=profile&profileSlug=${encodeURIComponent(profileSlug)}`;
  }
  return `from=${origin}`;
}

/**
 * Appends the from param to a URL for breadcrumb origin tracking.
 */
export function addFromParam(
  url: string,
  origin: BreadcrumbOrigin,
  profileSlug?: string,
): string {
  const fromQuery = getFromQueryString(origin, profileSlug);
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${fromQuery}`;
}

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
