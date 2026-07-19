'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  SalesBanner,
  SpaceEscrowDepositBanners,
  checkAccess,
  useSpaceDiscoverability,
  useUserSpaceState,
} from '@hypha-platform/epics';
import type { Locale } from '@hypha-platform/i18n';

type SpaceActivityGatedBannersProps = {
  web3SpaceId?: number;
  spaceDbId: number;
  spaceSlug: string;
  lang: Locale;
};

/**
 * Renewal / escrow banners are space-member surfaces. Hide them until activity
 * access is known and allowed so org-gated outsiders don't see a renewal nag
 * above an empty or denied tab.
 */
export function SpaceActivityGatedBanners({
  web3SpaceId,
  spaceDbId,
  spaceSlug,
  lang,
}: SpaceActivityGatedBannersProps) {
  const { isLoading: isAuthLoading } = useAuthentication();
  const { access, isLoading: isAccessLoading } = useSpaceDiscoverability({
    spaceId: web3SpaceId != null ? BigInt(web3SpaceId) : undefined,
  });
  const { userState } = useUserSpaceState({
    spaceId: web3SpaceId,
    spaceSlug,
  });

  if (web3SpaceId == null) {
    return null;
  }

  if (isAuthLoading || isAccessLoading || access === undefined) {
    return null;
  }

  // Fail closed: hide member-only banners until activity access is allowed.
  if (!checkAccess(access, userState)) {
    return null;
  }

  return (
    <>
      <SalesBanner web3SpaceId={web3SpaceId} />
      <SpaceEscrowDepositBanners
        web3SpaceId={web3SpaceId}
        spaceDbId={spaceDbId}
        spaceSlug={spaceSlug}
        lang={lang}
      />
    </>
  );
}
