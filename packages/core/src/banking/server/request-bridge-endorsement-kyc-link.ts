import 'server-only';

import type { BankCustomer } from '@hypha-platform/storage-postgres';

import { bridgeGetCustomerKycLink } from '../../common/server/bridge-client';
import type { DatabaseInstance } from '../../common/server/types';
import { BankOnboardingError } from './errors';
import { mapBridgeApiError } from './map-bridge-api-error';
import {
  parseBridgeEndorsements,
  type BridgeEndorsement,
} from './providers/bridge/endorsements';
import { rotateBankCustomerKycLink } from './rotate-bank-customer-kyc-link';
import { syncBankCustomerKycFromBridge } from './sync-bank-customer-kyc-from-bridge';

export async function requestBridgeEndorsementKycLink(
  customer: BankCustomer,
  endorsement: string,
  { db }: { db: DatabaseInstance },
): Promise<BankCustomer> {
  const parsedEndorsement = parseBridgeEndorsements([endorsement])[0];

  let providerCustomerId = customer.providerCustomerId;
  if (!providerCustomerId) {
    const synced = await syncBankCustomerKycFromBridge(customer, { db });
    providerCustomerId = synced.customer.providerCustomerId ?? null;
    customer = synced.customer;
  }

  if (!providerCustomerId) {
    throw new BankOnboardingError(
      'Bridge customer is not ready yet. Complete base verification first.',
      422,
    );
  }

  try {
    const kycLink = await bridgeGetCustomerKycLink(providerCustomerId, {
      endorsement: parsedEndorsement,
    });
    return rotateBankCustomerKycLink(
      customer,
      kycLink,
      parsedEndorsement as BridgeEndorsement,
      { db },
    );
  } catch (error) {
    const mapped = mapBridgeApiError(error, 'GET /customers/{id}/kyc_link');
    if (mapped) {
      throw mapped;
    }
    throw error;
  }
}
