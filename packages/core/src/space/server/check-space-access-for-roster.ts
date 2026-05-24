import { publicClient } from '../../common/web3/public-client';
import { findSelf } from '../../people/server/queries';
import { getDb } from '../../common/server/get-db';
import { and, eq } from 'drizzle-orm';
import { memberships } from '@hypha-platform/storage-postgres';
import {
  findAllOrganizationSpacesForNodeById,
  findSpaceByWeb3Id,
} from './queries';
import { getSpaceDetails } from '../shared/web3/get-space-details';
import { getSpaceVisibility } from '../client/web3/dao-space-factory/get-space-visibility';
import { getDelegatesForSpace } from '../client/web3/dao-space-factory/get-delegates-for-space';
import { getDelegators } from '../client/web3/dao-space-factory/get-delegators';
import { isMember as isMemberConfig } from '../client/web3/dao-space-factory/is-member';
import type { Space } from '../types';

export enum SpaceTransparencyLevel {
  PUBLIC = 0,
  NETWORK = 1,
  ORGANISATION = 2,
  SPACE = 3,
}

export type CheckSpaceAccessForRosterResult =
  | { hasAccess: true }
  | { hasAccess: false; message: string; httpStatus: 401 | 403 | 500 };

/**
 * Same visibility / membership rules as `apps/web` `checkSpaceAccess`, without Next.js.
 * Used by MCP stdio server to mirror GET /api/v1/spaces/[spaceSlug]/members gating.
 */
export async function checkSpaceAccessForSpace(
  host: Pick<Space, 'id' | 'web3SpaceId'>,
  authToken: string | undefined,
  options?: { requireMembershipWhenOffChain?: boolean },
): Promise<CheckSpaceAccessForRosterResult> {
  if (host.web3SpaceId == null) {
    if (!options?.requireMembershipWhenOffChain) {
      return { hasAccess: true };
    }
    if (!authToken) {
      return {
        hasAccess: false,
        message: 'Authentication required to access this space.',
        httpStatus: 401,
      };
    }
    try {
      const db = getDb({ authToken });
      const person = await findSelf({ db });
      if (!person?.id) {
        return {
          hasAccess: false,
          message: 'Could not verify your identity.',
          httpStatus: 401,
        };
      }
      const [membership] = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.spaceId, host.id),
            eq(memberships.personId, person.id),
          ),
        )
        .limit(1);
      if (!membership) {
        return {
          hasAccess: false,
          message: 'You need to be a member of this space to access its data.',
          httpStatus: 403,
        };
      }
      return { hasAccess: true };
    } catch (error) {
      console.error('checkSpaceAccessForSpace off-chain membership:', error);
      return {
        hasAccess: false,
        message: 'An error occurred while checking your permissions.',
        httpStatus: 500,
      };
    }
  }

  const spaceIdBigInt = BigInt(host.web3SpaceId);

  try {
    const visibility = await publicClient.readContract(
      getSpaceVisibility({ spaceId: spaceIdBigInt }),
    );

    // viem may return either a struct `{ access: number }` or a positional tuple; normalize to level 0–3.
    const accessLevel = Number(
      'access' in visibility ? visibility.access : visibility[1],
    ) as SpaceTransparencyLevel;

    if (accessLevel === SpaceTransparencyLevel.PUBLIC) {
      return { hasAccess: true };
    }

    if (!authToken) {
      return {
        hasAccess: false,
        message:
          'This space requires authentication to access its data. Provide Authorization: Bearer <token> in MCP config (e.g. HYPHA_MCP_AUTH_TOKEN).',
        httpStatus: 401,
      };
    }

    const db = getDb({ authToken });
    const person = await findSelf({ db });

    if (!person?.address) {
      return {
        hasAccess: false,
        message: 'Could not verify your identity.',
        httpStatus: 401,
      };
    }

    const userAddress = person.address as `0x${string}`;

    if (accessLevel === SpaceTransparencyLevel.NETWORK) {
      return { hasAccess: true };
    }

    const isMemberResult = await publicClient.readContract(
      isMemberConfig({
        spaceId: spaceIdBigInt,
        memberAddress: userAddress,
      }),
    );

    if (isMemberResult) {
      return { hasAccess: true };
    }

    const delegates = await publicClient.readContract(
      getDelegatesForSpace({ spaceId: spaceIdBigInt }),
    );

    const isInDelegates = delegates.some(
      (delegate) => delegate.toLowerCase() === userAddress.toLowerCase(),
    );

    if (isInDelegates) {
      const spaceDetails = await publicClient.readContract(
        getSpaceDetails({ spaceId: spaceIdBigInt }),
      );
      const [, , , , members] = spaceDetails;

      const delegators = await publicClient.readContract(
        getDelegators({
          user: userAddress,
          spaceId: spaceIdBigInt,
        }),
      );

      const membersLower = members.map((member: string) =>
        member?.toLowerCase(),
      );

      const isValidDelegate = delegators.some((delegator: `0x${string}`) =>
        membersLower.includes(delegator?.toLowerCase()),
      );

      if (isValidDelegate) {
        return { hasAccess: true };
      }
    }

    if (accessLevel === SpaceTransparencyLevel.ORGANISATION) {
      const targetSpace = await findSpaceByWeb3Id(
        { id: Number(spaceIdBigInt) },
        { db },
      );

      if (targetSpace?.id) {
        const organisationSpaces = await findAllOrganizationSpacesForNodeById(
          { id: targetSpace.id },
          { db },
        );
        const siblingWeb3Ids = organisationSpaces
          .map((orgSpace) => orgSpace.web3SpaceId)
          .filter(
            (orgSpaceId): orgSpaceId is number =>
              typeof orgSpaceId === 'number' &&
              Number.isSafeInteger(orgSpaceId) &&
              orgSpaceId > 0 &&
              orgSpaceId !== Number(spaceIdBigInt),
          );

        if (siblingWeb3Ids.length > 0) {
          const siblingChecks = await Promise.all(
            siblingWeb3Ids.map(async (siblingId) => {
              try {
                const siblingBigInt = BigInt(siblingId);
                const siblingMember = await publicClient.readContract(
                  isMemberConfig({
                    spaceId: siblingBigInt,
                    memberAddress: userAddress,
                  }),
                );
                if (siblingMember) {
                  return true;
                }

                const siblingDelegates = await publicClient.readContract(
                  getDelegatesForSpace({ spaceId: siblingBigInt }),
                );
                const isSiblingDelegate = siblingDelegates.some(
                  (delegate) =>
                    delegate.toLowerCase() === userAddress.toLowerCase(),
                );
                if (!isSiblingDelegate) {
                  return false;
                }

                const siblingDetails = await publicClient.readContract(
                  getSpaceDetails({ spaceId: siblingBigInt }),
                );
                const [, , , , siblingMembers] = siblingDetails;
                const siblingDelegators = await publicClient.readContract(
                  getDelegators({
                    user: userAddress,
                    spaceId: siblingBigInt,
                  }),
                );
                const siblingMembersLower = siblingMembers.map(
                  (member: string) => member?.toLowerCase(),
                );
                return siblingDelegators.some((delegator: `0x${string}`) =>
                  siblingMembersLower.includes(delegator?.toLowerCase()),
                );
              } catch (error) {
                console.error(
                  `checkSpaceAccessForSpace sibling org membership check failed for ${siblingId}:`,
                  error,
                );
                return false;
              }
            }),
          );

          if (siblingChecks.some(Boolean)) {
            return { hasAccess: true };
          }
        }
      }

      return {
        hasAccess: false,
        message:
          'You need to be a member of the organisation to access this space data.',
        httpStatus: 403,
      };
    }

    return {
      hasAccess: false,
      message: 'You need to be a member of this space to access its data.',
      httpStatus: 403,
    };
  } catch (error) {
    console.error('checkSpaceAccessForSpace:', error);
    return {
      hasAccess: false,
      message: 'An error occurred while checking your permissions.',
      httpStatus: 500,
    };
  }
}
