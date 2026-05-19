'use client';

import {
  JoinSpace,
  UserSpaceState,
  checkAccess,
  useSpaceDiscoverability,
  useUserSpaceState,
} from '@hypha-platform/epics';

type SpaceMembershipCtaUnderHeroProps = {
  spaceId: number;
  web3SpaceId: number;
  spaceSlug: string;
};

export function SpaceMembershipCtaUnderHero({
  spaceId,
  web3SpaceId,
  spaceSlug,
}: SpaceMembershipCtaUnderHeroProps) {
  const { userState, isLoading } = useUserSpaceState({
    spaceId: web3SpaceId,
    spaceSlug,
  });
  const { access, isLoading: isAccessLoading } = useSpaceDiscoverability({
    spaceId: BigInt(web3SpaceId),
  });

  const hasActivityAccess = checkAccess(access, userState);

  if (
    isLoading ||
    isAccessLoading ||
    userState !== UserSpaceState.LOGGED_IN_ORG ||
    !hasActivityAccess
  ) {
    return null;
  }

  return (
    <div className="flex w-full items-center justify-end py-2">
      <JoinSpace spaceId={spaceId} web3SpaceId={web3SpaceId} hideWhenMember />
    </div>
  );
}
