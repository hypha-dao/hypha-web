'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useIsDelegate } from '@hypha-platform/core/client';
import {
  JoinSpace,
  UserSpaceState,
  checkAccess,
  useSpaceDiscoverability,
  useSpaceMember,
  useUserSpaceState,
} from '@hypha-platform/epics';

type SpaceMembershipCtaUnderHeroProps = {
  spaceId: number;
  web3SpaceId: number;
  spaceSlug: string;
};

/**
 * Membership CTA under the space hero when activity content is visible.
 *
 * Transparency matrix:
 * - Show Become member / Request Invite for authenticated personal non-members
 *   whenever they can see activity (Public / Network / Organisation-eligible).
 * - Space-to-space participants may count as LOGGED_IN_SPACE for activity
 *   access but still need a personal join CTA (proposal/join boundary).
 * - When activity is denied, Join lives in SpaceAccessDenied instead.
 *
 * Do not wait on full `useUserSpaceState.isLoading`: after org membership
 * resolves (content visible), sibling/participant checks can keep `isLoading`
 * true and would hide this CTA — the Hypha Energy Iberia regression.
 */
export function SpaceMembershipCtaUnderHero({
  spaceId,
  web3SpaceId,
  spaceSlug,
}: SpaceMembershipCtaUnderHeroProps) {
  const { isAuthenticated } = useAuthentication();
  const { userState } = useUserSpaceState({
    spaceId: web3SpaceId,
    spaceSlug,
  });
  const { access, isLoading: isAccessLoading } = useSpaceDiscoverability({
    spaceId: BigInt(web3SpaceId),
  });
  const { isMember, isMemberLoading } = useSpaceMember({
    spaceId: web3SpaceId,
  });
  const { isDelegate, isLoading: isDelegateLoading } = useIsDelegate({
    spaceId: web3SpaceId,
  });

  const hasActivityAccess = checkAccess(access, userState);
  const isPersonalMember = Boolean(isMember || isDelegate);
  const membershipResolved = !isMemberLoading && !isDelegateLoading;
  const accessLevelResolved = !isAccessLoading && access !== undefined;

  // Guests never get Join here (sign-in lives in denied / auth surfaces).
  if (!isAuthenticated) {
    return null;
  }

  // Wait only for on-chain activity level + personal membership. Full user-state
  // loading includes org/participant checks that outlive activity becoming visible.
  if (!accessLevelResolved || !membershipResolved) {
    return null;
  }

  if (isPersonalMember) {
    return null;
  }

  // Denied activity path owns the CTA (SpaceAccessDenied). Under-hero is for
  // content-visible non-members — including org members who are not yet
  // personal members of this space (userState LOGGED_IN_ORG).
  const isContentVisibleNonMember =
    hasActivityAccess &&
    (userState === UserSpaceState.LOGGED_IN ||
      userState === UserSpaceState.LOGGED_IN_ORG ||
      userState === UserSpaceState.LOGGED_IN_SPACE);

  if (!isContentVisibleNonMember) {
    return null;
  }

  return (
    <div className="flex w-full items-center justify-end py-2">
      <JoinSpace spaceId={spaceId} web3SpaceId={web3SpaceId} hideWhenMember />
    </div>
  );
}
