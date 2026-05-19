import { NextRequest, NextResponse } from 'next/server';
import {
  publicClient,
  getSpaceVisibility,
  isMember as isMemberConfig,
  getSpaceDetails,
  getDelegatesForSpace,
  getDelegators,
} from '@hypha-platform/core/client';
import {
  findSelf,
  getDb,
  findSpaceByWeb3Id,
  findAllOrganizationSpacesForNodeById,
} from '@hypha-platform/core/server';

export enum TransparencyLevel {
  PUBLIC = 0,
  NETWORK = 1,
  ORGANISATION = 2,
  SPACE = 3,
}

export type CheckSpaceAccessResult = {
  hasAccess: boolean;
  response?: NextResponse;
  userAddress?: `0x${string}`;
  authToken?: string;
};

/**
 * Checks if the user has access to a space based on the transparency matrix.
 * This function enforces server-side authorization for space data.
 *
 * @param request - The incoming NextRequest
 * @param spaceId - The web3 space ID to check access for
 * @returns Object with hasAccess boolean and optional error response
 */
export async function checkSpaceAccess(
  request: NextRequest,
  spaceId: number | bigint,
): Promise<CheckSpaceAccessResult> {
  try {
    const spaceIdBigInt =
      typeof spaceId === 'number' ? BigInt(spaceId) : spaceId;

    const visibility = await publicClient.readContract(
      getSpaceVisibility({ spaceId: spaceIdBigInt }),
    );

    const accessLevel = Number(
      'access' in visibility ? visibility.access : visibility[1],
    ) as TransparencyLevel;

    if (accessLevel === TransparencyLevel.PUBLIC) {
      return { hasAccess: true };
    }

    const authToken = request.headers.get('Authorization')?.split(' ')[1];

    if (!authToken) {
      return {
        hasAccess: false,
        response: NextResponse.json(
          {
            error: 'Authentication required',
            message: 'This space requires authentication to access its data.',
          },
          { status: 401 },
        ),
      };
    }

    const db = getDb({ authToken });
    const person = await findSelf({ db });

    if (!person?.address) {
      return {
        hasAccess: false,
        response: NextResponse.json(
          {
            error: 'Invalid authentication',
            message: 'Could not verify your identity.',
          },
          { status: 401 },
        ),
      };
    }

    const userAddress = person.address as `0x${string}`;

    if (accessLevel === TransparencyLevel.NETWORK) {
      return { hasAccess: true, userAddress, authToken };
    }

    const isMemberResult = await publicClient.readContract(
      isMemberConfig({
        spaceId: spaceIdBigInt,
        memberAddress: userAddress,
      }),
    );

    if (isMemberResult) {
      return { hasAccess: true, userAddress, authToken };
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
        return { hasAccess: true, userAddress, authToken };
      }
    }

    if (accessLevel === TransparencyLevel.ORGANISATION) {
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
                  `Error checking sibling org membership for space ${siblingId}:`,
                  error,
                );
                return false;
              }
            }),
          );

          if (siblingChecks.some(Boolean)) {
            return { hasAccess: true, userAddress, authToken };
          }
        }
      }

      return {
        hasAccess: false,
        response: NextResponse.json(
          {
            error: 'Access denied',
            message:
              'You need to be a member of the organisation to access this space data.',
          },
          { status: 403 },
        ),
      };
    }

    return {
      hasAccess: false,
      response: NextResponse.json(
        {
          error: 'Access denied',
          message: 'You need to be a member of this space to access its data.',
        },
        { status: 403 },
      ),
    };
  } catch (error) {
    console.error('Error checking space access:', error);
    return {
      hasAccess: false,
      response: NextResponse.json(
        {
          error: 'Failed to verify access',
          message: 'An error occurred while checking your permissions.',
        },
        { status: 500 },
      ),
    };
  }
}
