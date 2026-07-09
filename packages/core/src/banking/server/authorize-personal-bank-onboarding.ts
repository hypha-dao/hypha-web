import { getDb } from '../../common/server/get-db';
import { findSelf } from '../../people/server/queries';
import type { BankOnboardingHttpStatus } from './errors';

export type AuthorizePersonalBankOnboardingInput = {
  person: { id: number };
  authToken: string;
};

export type AuthorizedPersonalBankOnboardingPerson = {
  id: number;
  slug: string | undefined;
};

export type AuthorizePersonalBankOnboardingResult =
  | { authorized: true; person: AuthorizedPersonalBankOnboardingPerson }
  | {
      authorized: false;
      message: string;
      httpStatus: BankOnboardingHttpStatus;
    };

/**
 * Personal (individual) bank onboarding is owner-scoped: the authenticated caller
 * may only manage banking for their own profile. Unlike the space flow there is no
 * membership/delegate check — identity ownership is the sole gate.
 */
export async function authorizePersonalBankOnboarding({
  person,
  authToken,
}: AuthorizePersonalBankOnboardingInput): Promise<AuthorizePersonalBankOnboardingResult> {
  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });

  if (!self) {
    return {
      authorized: false,
      httpStatus: 401,
      message: 'Could not verify your identity.',
    };
  }

  if (self.id !== person.id) {
    return {
      authorized: false,
      httpStatus: 403,
      message: 'You can only manage banking for your own profile.',
    };
  }

  return {
    authorized: true,
    person: { id: self.id, slug: self.slug },
  };
}
