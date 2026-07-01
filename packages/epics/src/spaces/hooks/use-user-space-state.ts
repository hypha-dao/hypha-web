'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import { useSpaceMember } from './use-space-member';
import { useMemberWeb3SpaceIds } from './use-member-web3-space-ids';
import {
  useIsDelegate,
  useSpaceDetailsWeb3Rpc,
} from '@hypha-platform/core/client';
import {
  useSpaceBySlug,
  Space,
  useOrganisationSpacesBySingleSlug,
  publicClient,
  isMember as isMemberConfig,
  getDelegatesForSpace,
  getDelegators,
  getSpaceDetails,
} from '@hypha-platform/core/client';
import { useMemo } from 'react';
import useSWR from 'swr';

export enum UserSpaceState {
  NOT_LOGGED_IN = 'NOT_LOGGED_IN',
  LOGGED_IN = 'LOGGED_IN',
  LOGGED_IN_ORG = 'LOGGED_IN_ORG',
  LOGGED_IN_SPACE = 'LOGGED_IN_SPACE',
}

export function useUserSpaceState({
  spaceId,
  spaceSlug,
  space,
}: {
  spaceId?: number;
  spaceSlug?: string;
  space?: Space | null;
}): {
  userState: UserSpaceState;
  isLoading: boolean;
} {
  const { isAuthenticated, user } = useAuthentication();
  const spaceFromHook = useSpaceBySlug(spaceSlug || '');
  const effectiveSpace = space || spaceFromHook.space;
  const effectiveSpaceId = spaceId || effectiveSpace?.web3SpaceId;

  const { isMember, isMemberLoading } = useSpaceMember({
    spaceId: effectiveSpaceId as number,
  });

  const { isDelegate, isLoading: isDelegateLoading } = useIsDelegate({
    spaceId: effectiveSpaceId as number,
    userAddress: user?.wallet?.address,
  });

  const {
    web3SpaceIds: userMemberWeb3SpaceIds,
    isLoading: isUserMemberWeb3SpaceIdsLoading,
  } = useMemberWeb3SpaceIds({ personAddress: user?.wallet?.address });

  const {
    spaceDetails: hostSpaceDetails,
    isLoading: isHostSpaceDetailsLoading,
  } = useSpaceDetailsWeb3Rpc({
    spaceId: effectiveSpaceId ?? undefined,
  });

  const hostMemberAddressesKey = useMemo(() => {
    const members = hostSpaceDetails?.members;
    if (!members?.length) return '';
    return members
      .map((member: string) => member.toLowerCase())
      .sort()
      .join(',');
  }, [hostSpaceDetails?.members]);

  const userMemberSpaceIdsKey = useMemo(() => {
    if (!userMemberWeb3SpaceIds?.length) return '';
    return userMemberWeb3SpaceIds
      .map((id) => id.toString())
      .sort()
      .join(',');
  }, [userMemberWeb3SpaceIds]);

  const {
    data: isMemberSpaceParticipant,
    isLoading: isMemberSpaceParticipantLoading,
  } = useSWR(
    isAuthenticated &&
      user?.wallet?.address &&
      effectiveSpaceId &&
      hostMemberAddressesKey &&
      userMemberSpaceIdsKey
      ? [
          'memberSpaceParticipant',
          effectiveSpaceId,
          hostMemberAddressesKey,
          userMemberSpaceIdsKey,
        ]
      : null,
    async () => {
      const hostMembersLower = new Set(
        hostSpaceDetails!.members.map((member: string) => member.toLowerCase()),
      );

      const checks = await Promise.all(
        userMemberWeb3SpaceIds!.map(async (spaceId) => {
          try {
            const details = await publicClient.readContract(
              getSpaceDetails({ spaceId }),
            );
            const executor = details[9] as string | undefined;
            return (
              typeof executor === 'string' &&
              hostMembersLower.has(executor.toLowerCase())
            );
          } catch (error) {
            console.error(
              `Error checking member-space access for space ${spaceId}:`,
              error,
            );
            return false;
          }
        }),
      );

      return checks.some(Boolean);
    },
  );

  const effectiveSpaceSlug = spaceSlug || effectiveSpace?.slug || '';
  const { spaces: organisationSpaces, isLoading: isOrganisationSpacesLoading } =
    useOrganisationSpacesBySingleSlug(effectiveSpaceSlug);

  const organisationSpaceIds = useMemo(() => {
    if (!organisationSpaces || !effectiveSpaceId) return [];
    return organisationSpaces
      .filter(
        (s) =>
          s.web3SpaceId &&
          s.web3SpaceId !== effectiveSpaceId &&
          typeof s.web3SpaceId === 'number',
      )
      .map((s) => s.web3SpaceId as number);
  }, [organisationSpaces, effectiveSpaceId]);

  const orgMembershipResults = useSWR(
    user?.wallet?.address && organisationSpaceIds.length > 0 && isAuthenticated
      ? ['orgMembership', user.wallet.address, ...organisationSpaceIds.sort()]
      : null,
    async () => {
      if (!user?.wallet?.address || organisationSpaceIds.length === 0) {
        return { isOrgMember: false, isOrgDelegate: false };
      }

      const userAddress = user.wallet.address as `0x${string}`;

      const membershipChecks = await Promise.all(
        organisationSpaceIds.map(async (spaceId) => {
          try {
            const [isMemberResult, delegates, spaceDetails] = await Promise.all(
              [
                publicClient.readContract(
                  isMemberConfig({
                    spaceId: BigInt(spaceId),
                    memberAddress: userAddress,
                  }),
                ),
                publicClient.readContract(
                  getDelegatesForSpace({ spaceId: BigInt(spaceId) }),
                ),
                publicClient.readContract(
                  getSpaceDetails({ spaceId: BigInt(spaceId) }),
                ),
              ],
            );

            const isInDelegates = delegates.some(
              (delegate) =>
                delegate.toLowerCase() === userAddress.toLowerCase(),
            );

            let isDelegate = false;
            if (isInDelegates) {
              const [, , , , members] = spaceDetails;
              const delegators = await publicClient.readContract(
                getDelegators({
                  user: userAddress,
                  spaceId: BigInt(spaceId),
                }),
              );

              const membersLower = members.map((member: string) =>
                member?.toLowerCase(),
              );
              isDelegate = delegators.some((delegator: `0x${string}`) =>
                membersLower.includes(delegator?.toLowerCase()),
              );
            }

            return {
              isMember: isMemberResult,
              isDelegate,
            };
          } catch (error) {
            console.error(
              `Error checking membership for space ${spaceId}:`,
              error,
            );
            return { isMember: false, isDelegate: false };
          }
        }),
      );

      const isOrgMember = membershipChecks.some((check) => check.isMember);
      const isOrgDelegate = membershipChecks.some((check) => check.isDelegate);

      return { isOrgMember, isOrgDelegate };
    },
  );

  const { data: orgMembershipData, isLoading: isOrgMembershipLoading } =
    orgMembershipResults;
  const isOrgMember = orgMembershipData?.isOrgMember ?? false;
  const isOrgDelegate = orgMembershipData?.isOrgDelegate ?? false;

  const userState = useMemo(() => {
    if (!isAuthenticated || !user) {
      return UserSpaceState.NOT_LOGGED_IN;
    }

    if (isMember || isDelegate || isMemberSpaceParticipant) {
      return UserSpaceState.LOGGED_IN_SPACE;
    }

    if (isOrgMember || isOrgDelegate) {
      return UserSpaceState.LOGGED_IN_ORG;
    }

    return UserSpaceState.LOGGED_IN;
  }, [
    isAuthenticated,
    user,
    isMember,
    isDelegate,
    isMemberSpaceParticipant,
    isOrgMember,
    isOrgDelegate,
  ]);

  const isLoading =
    isMemberLoading ||
    isDelegateLoading ||
    isUserMemberWeb3SpaceIdsLoading ||
    isHostSpaceDetailsLoading ||
    isMemberSpaceParticipantLoading ||
    isOrganisationSpacesLoading ||
    isOrgMembershipLoading ||
    spaceFromHook.isLoading;

  return {
    userState,
    isLoading,
  };
}
