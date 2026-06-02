import type { DatabaseInstance } from '../../common/server/types';
import { verifyBankConfirmationJwt } from '../../common/server/sign-bank-confirmation-jwt';
import type { BankOnboardingResult } from '../types';
import {
  buildBankOnboardingResultFromKycLink,
  performKycLinkAndInsert,
} from './perform-kyc-link-and-insert';
import { updateBankCustomerWithKycLink } from './mutations';
import { findBankCustomerByNonce } from './queries';

export type ValidateAndConfirmBankEmailResult =
  | {
      ok: true;
      result: BankOnboardingResult;
      spaceSlug: string;
      bridgeCustomerEmail: string;
      legalName: string;
    }
  | {
      ok: false;
      reason: 'invalid' | 'already_confirmed' | 'not_found';
    };

export async function validateAndConfirmBankEmail(
  token: string,
  { db }: { db: DatabaseInstance },
): Promise<ValidateAndConfirmBankEmailResult> {
  let payload;
  try {
    payload = await verifyBankConfirmationJwt(token);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  const customer = await findBankCustomerByNonce({ nonce: payload.jti }, { db });
  if (!customer) {
    return { ok: false, reason: 'not_found' };
  }

  if (customer.providerKycLinkId) {
    return { ok: false, reason: 'already_confirmed' };
  }

  const performResult = await performKycLinkAndInsert(
    {
      legalName: payload.legalName,
      contactEmail: payload.bridgeCustomerEmail,
      requestedRails: payload.requestedRails,
      redirectUri: payload.redirectUri,
    },
    { db },
  );

  await updateBankCustomerWithKycLink(
    {
      id: customer.id,
      providerKycLinkId: performResult.kycLinkResult.providerKycLinkId,
      providerCustomerId: performResult.kycLinkResult.providerCustomerId,
      requestedRails: payload.requestedRails,
    },
    { db },
  );

  const result = buildBankOnboardingResultFromKycLink({
    kycLinkResult: performResult.kycLinkResult,
    created: performResult.created,
    spaceTitle: payload.spaceTitle,
    requesterSlug: payload.personSlug,
  });

  return {
    ok: true,
    result,
    spaceSlug: payload.spaceSlug,
    bridgeCustomerEmail: payload.bridgeCustomerEmail,
    legalName: payload.legalName,
  };
}
