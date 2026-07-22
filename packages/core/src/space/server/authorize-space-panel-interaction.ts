import { db } from '@hypha-platform/storage-postgres';

import type { Person } from '../../people/types';
import { resolvePersonFromAuthToken } from '../../people/server/resolve-person-from-auth-token';
import { findSpaceBySlug } from './queries';
import { hasPostgresSpaceMembership } from './check-space-access-for-roster';
import { isOnChainMemberOrDelegate } from './is-on-chain-member-or-delegate';

export async function authorizeSpacePanelInteraction({
  spaceSlug,
  authToken,
}: {
  spaceSlug: string;
  authToken: string;
}): Promise<
  { authorized: true; person: Person } | { authorized: false; message: string }
> {
  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return { authorized: false, message: 'Space not found.' };
    }

    const person = await resolvePersonFromAuthToken(authToken);
    if (!person?.id) {
      return { authorized: false, message: 'Could not verify your identity.' };
    }

    if (await hasPostgresSpaceMembership(space.id, authToken)) {
      return { authorized: true, person };
    }

    if (space.web3SpaceId == null) {
      return {
        authorized: false,
        message:
          'You must be a space member or delegate to interact in this space.',
      };
    }

    if (!person.address) {
      return { authorized: false, message: 'Could not verify your identity.' };
    }

    try {
      const allowed = await isOnChainMemberOrDelegate(
        space.web3SpaceId,
        person.address as `0x${string}`,
      );
      if (allowed) {
        return { authorized: true, person };
      }
    } catch (onChainError) {
      console.error(
        '[authorizeSpacePanelInteraction] on-chain check failed',
        onChainError,
      );
    }

    return {
      authorized: false,
      message:
        'You must be a space member or delegate to interact in this space.',
    };
  } catch (error) {
    console.error('[authorizeSpacePanelInteraction]', error);
    try {
      const person = await resolvePersonFromAuthToken(authToken);
      const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
      if (!person?.id || !space) {
        return {
          authorized: false,
          message: 'An error occurred while checking your permissions.',
        };
      }

      if (await hasPostgresSpaceMembership(space.id, authToken)) {
        return { authorized: true, person };
      }

      if (
        person.address &&
        space.web3SpaceId != null &&
        (await isOnChainMemberOrDelegate(
          space.web3SpaceId,
          person.address as `0x${string}`,
        ))
      ) {
        return { authorized: true, person };
      }
    } catch (fallbackError) {
      console.error(
        '[authorizeSpacePanelInteraction] fallback failed',
        fallbackError,
      );
    }

    return {
      authorized: false,
      message: 'An error occurred while checking your permissions.',
    };
  }
}
