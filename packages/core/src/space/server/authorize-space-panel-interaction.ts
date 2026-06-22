import { findSelf } from '../../people/server/queries';
import { getDb } from '../../common/server/get-db';
import { findSpaceBySlug } from './queries';
import { hasPostgresSpaceMembership } from './check-space-access-for-roster';
import { isOnChainMemberOrDelegate } from './is-on-chain-member-or-delegate';

export async function authorizeSpacePanelInteraction({
  spaceSlug,
  authToken,
}: {
  spaceSlug: string;
  authToken: string;
}): Promise<{ authorized: true } | { authorized: false; message: string }> {
  try {
    const db = getDb({ authToken });
    const person = await findSelf({ db });

    if (!person?.id) {
      return { authorized: false, message: 'Could not verify your identity.' };
    }

    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return { authorized: false, message: 'Space not found.' };
    }

    if (await hasPostgresSpaceMembership(space.id, authToken)) {
      return { authorized: true };
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
        return { authorized: true };
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
      const db = getDb({ authToken });
      const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
      if (space && (await hasPostgresSpaceMembership(space.id, authToken))) {
        return { authorized: true };
      }
    } catch (fallbackError) {
      console.error(
        '[authorizeSpacePanelInteraction] postgres fallback failed',
        fallbackError,
      );
    }
    return {
      authorized: false,
      message: 'An error occurred while checking your permissions.',
    };
  }
}
