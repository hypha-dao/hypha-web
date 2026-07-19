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
 * - Show Become member / Request Invite for authenticated users who are not
 *   personal members/delegates of the target space, whenever they can see
 *   activity (Public / Network / Organisation-eligible).
 * - Space-to-space participants may count as LOGGED_IN_SPACE for activity
 *   access but still need a personal join CTA (proposal/join boundary).
 * - When activity is denied, Join lives in SpaceAccessDenied instead.
 */
export function SpaceMembershipCtaUnderHero({
  spaceId,
  web3SpaceId,
  spaceSlug,
}: SpaceMembershipCtaUnderHeroProps) {
  const { isAuthenticated } = useAuthentication();
  const { userState, isLoading } = useUserSpaceState({
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
  const accessResolved = !isLoading && !isAccessLoading && access !== undefined;

  // Guests never get Join here (sign-in lives in denied / auth surfaces).
  if (!isAuthenticated) {
    return null;
  }

  // Do not flash under-hero Join while access/membership are unknown.
  // Denied activity owns the CTA in SpaceAccessDenied once resolved.
  if (!accessResolved || !membershipResolved) {
    return null;
  }

  if (isPersonalMember) {
    return null;
  }

  // Denied activity path owns the CTA (SpaceAccessDenied). Under-hero is for
  // content-visible non-members — including space-to-space participants who
  // are not personal members (userState may be LOGGED_IN_SPACE).
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
