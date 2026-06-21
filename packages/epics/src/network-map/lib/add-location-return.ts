import type { Locale } from '@hypha-platform/i18n';

/** Query param marking space configuration opened from the network map add-location flow. */
export const NETWORK_ADD_LOCATION_FROM_PARAM = 'from';
export const NETWORK_ADD_LOCATION_FROM_VALUE = 'network-add-location';

export function buildNetworkAddLocationConfigurationPath(
  lang: Locale,
  spaceSlug: string,
): string {
  const params = new URLSearchParams({
    [NETWORK_ADD_LOCATION_FROM_PARAM]: NETWORK_ADD_LOCATION_FROM_VALUE,
  });
  return `/${lang}/dho/${spaceSlug}/agreements/space-configuration?${params.toString()}`;
}

export function isNetworkAddLocationReturn(
  searchParams: Pick<URLSearchParams, 'get'>,
): boolean {
  return (
    searchParams.get(NETWORK_ADD_LOCATION_FROM_PARAM) ===
    NETWORK_ADD_LOCATION_FROM_VALUE
  );
}

export function getNetworkMapReturnPath(lang: Locale): string {
  return `/${lang}/network?view=map`;
}
