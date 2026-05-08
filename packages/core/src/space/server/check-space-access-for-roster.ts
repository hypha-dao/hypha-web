import { publicClient } from '../../common/web3/public-client';
import { findSelf } from '../../people/server/queries';
import { getDb } from '../../common/server/get-db';
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
  host: Pick<Space, 'web3SpaceId'>,
  authToken: string | undefined,
): Promise<CheckSpaceAccessForRosterResult> {
  if (host.web3SpaceId == null) {
    return { hasAccess: true };
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
