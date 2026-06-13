import { randomUUID } from 'node:crypto';

import type { DatabaseInstance } from '../../common/server/types';
import { signBankConfirmationJwt } from '../../common/server/sign-bank-confirmation-jwt';
import { DEFAULT_BANK_PROVIDER } from '../constants';
import type { BankEntityType } from '../types';
import type { Space } from '../../space/types';
import type { AuthorizedBankOnboardingPerson } from './authorize-space-bank-onboarding';
import {
  insertPendingBankCustomer,
  rotatePendingBankCustomerNonce,
} from './mutations';
import { findPendingBankCustomerForSpace } from './queries';

export type InitiateEmailConfirmationInput = {
  space: Pick<Space, 'id' | 'slug' | 'title'>;
  person: AuthorizedBankOnboardingPerson;
  legalName: string;
  providerCustomerEmail: string;
  requestedRails: string[];
  redirectUri?: string | null;
  entityType?: BankEntityType;
};

export type InitiateEmailConfirmationResult = {
  signedJwt: string;
  contactEmail: string;
  spaceTitle: string;
};

export async function initiateEmailConfirmation(
  input: InitiateEmailConfirmationInput,
  { db }: { db: DatabaseInstance },
): Promise<InitiateEmailConfirmationResult> {
  const {
    space,
    person,
    legalName,
    providerCustomerEmail,
    requestedRails,
    redirectUri,
    entityType = 'business',
  } = input;

  const normalizedRails = requestedRails.map((rail) => rail.toLowerCase());
  const jti = randomUUID();
  const spaceSlug = space.slug ?? '';

  const pending = await findPendingBankCustomerForSpace(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  const row = pending
    ? await rotatePendingBankCustomerNonce(
        { id: pending.id, jwtNonce: jti, requestedRails: normalizedRails },
        { db },
      )
    : await insertPendingBankCustomer(
        {
          spaceId: space.id,
          entityType,
          provider: DEFAULT_BANK_PROVIDER,
          jwtNonce: jti,
          requestedRails: normalizedRails,
        },
        { db },
      );

  const signedJwt = await signBankConfirmationJwt({
    jti,
    spaceId: space.id,
    spaceSlug,
    spaceBankCustomerId: row.id,
    provider: DEFAULT_BANK_PROVIDER,
    providerCustomerEmail: providerCustomerEmail,
    legalName,
    requestedRails: normalizedRails,
    personSlug: person.slug ?? null,
    spaceTitle: space.title,
    redirectUri: redirectUri ?? null,
  });

  return {
    signedJwt,
    contactEmail: providerCustomerEmail,
    spaceTitle: space.title,
  };
}
