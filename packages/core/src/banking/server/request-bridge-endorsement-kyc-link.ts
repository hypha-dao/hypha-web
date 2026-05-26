import 'server-only';

import type { BankCustomer } from '@hypha-platform/storage-postgres';

import { bridgeGetCustomerKycLink } from '../../common/server/bridge-client';
import { mergeRequestedRails } from '../constants';
import type { DatabaseInstance } from '../../common/server/types';
import { BankOnboardingError } from './errors';
import { mapBridgeApiError } from './map-bridge-api-error';
import { parseBridgeEndorsements } from './providers/bridge/endorsements';
import { updateBankCustomer } from './mutations';
import { syncProviderCustomerIdFromKycLink } from './providers/bridge/banking-provider-state';
import { resolveBridgeCustomerEmail } from './resolve-bridge-customer-email';

export type RequestBridgeEndorsementKycLinkResult = {
  customer: BankCustomer;
  kycLinkUrl: string;
};

export async function requestBridgeEndorsementKycLink(
  customer: BankCustomer,
  endorsement: string,
  { db }: { db: DatabaseInstance },
): Promise<RequestBridgeEndorsementKycLinkResult> {
  const parsedEndorsement = parseBridgeEndorsements([endorsement])[0];

  let providerCustomerId = customer.providerCustomerId;
  if (!providerCustomerId) {
    providerCustomerId = await syncProviderCustomerIdFromKycLink(customer);
  }

  if (!providerCustomerId) {
    throw new BankOnboardingError(
      'Bridge customer is not ready yet. Complete base verification first.',
      422,
    );
  }

  const bridgeEmail = await resolveBridgeCustomerEmail(customer);

  const requestedRails = mergeRequestedRails(
    customer.requestedRails ?? [],
    parsedEndorsement,
  );

  try {
    const kycLink = await bridgeGetCustomerKycLink(
      providerCustomerId,
      {
        endorsement: parsedEndorsement,
        email: bridgeEmail,
      },
      { existingKycLinkId: customer.providerKycLinkId },
    );

    const shouldUpdateKycLinkId =
      kycLink.id !== customer.providerKycLinkId &&
      kycLink.id !== providerCustomerId;

    const updated = await updateBankCustomer(
      {
        id: customer.id,
        providerCustomerId: kycLink.customer_id ?? providerCustomerId,
        requestedRails,
        ...(shouldUpdateKycLinkId ? { providerKycLinkId: kycLink.id } : {}),
      },
      { db },
    );

    return {
      customer: updated,
      kycLinkUrl: kycLink.kyc_link,
    };
  } catch (error) {
    const mapped = mapBridgeApiError(error, 'GET /customers/{id}/kyc_link');
    if (mapped) {
      throw mapped;
    }
    throw error;
  }
}
