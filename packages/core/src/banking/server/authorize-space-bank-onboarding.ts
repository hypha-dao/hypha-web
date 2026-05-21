import { canConvertToBigInt } from '@hypha-platform/ui-utils';

import { getDb } from '../../common/server/get-db';
import { findSelf } from '../../people/server/queries';
import { isOnChainMemberOrDelegate } from '../../space/server/is-on-chain-member-or-delegate';
import type { Space } from '../../space/types';
import type { BankOnboardingHttpStatus } from './errors';

export type AuthorizeSpaceBankOnboardingInput = {
  space: Pick<Space, 'web3SpaceId' | 'address'>;
  authToken: string;
};

export type AuthorizedBankOnboardingPerson = {
  id: number;
  slug: string | undefined;
};

export type AuthorizeSpaceBankOnboardingResult =
  | { authorized: true; person: AuthorizedBankOnboardingPerson }
  | {
      authorized: false;
      message: string;
      httpStatus: BankOnboardingHttpStatus;
    };

/**
 * Bank onboarding requires an on-chain space with a treasury address and an
 * on-chain member or delegate caller — same membership source of truth as
 * `checkSpaceAccess` / Members tab. Web2 `memberships` is not used.
 */
export async function authorizeSpaceBankOnboarding({
  space,
  authToken,
}: AuthorizeSpaceBankOnboardingInput): Promise<AuthorizeSpaceBankOnboardingResult> {
  if (
    space.web3SpaceId == null ||
    !canConvertToBigInt(space.web3SpaceId as number)
  ) {
    return {
      authorized: false,
      httpStatus: 422,
      message:
        'This space must be deployed on-chain before bank accounts can be enabled.',
    };
  }

  if (!space.address?.trim()) {
    return {
      authorized: false,
      httpStatus: 422,
      message:
        'This space must have an on-chain treasury address before bank accounts can be enabled.',
    };
  }

  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });

  if (!self) {
    return {
      authorized: false,
      httpStatus: 401,
      message: 'Could not verify your identity.',
    };
  }

  if (!self.address) {
    return {
      authorized: false,
      httpStatus: 403,
      message:
        'Could not verify your wallet address. Connect a wallet to enable bank accounts for this space.',
    };
  }

  try {
    const allowed = await isOnChainMemberOrDelegate(
      space.web3SpaceId as number,
      self.address as `0x${string}`,
    );

    if (!allowed) {
      return {
        authorized: false,
        httpStatus: 403,
        message:
          'You must be a space member or delegate to enable bank accounts.',
      };
    }

    return {
      authorized: true,
      person: { id: self.id, slug: self.slug },
    };
  } catch (error) {
    console.error('authorizeSpaceBankOnboarding:', error);
    return {
      authorized: false,
      httpStatus: 500,
      message: 'An error occurred while checking your permissions.',
    };
  }
}
