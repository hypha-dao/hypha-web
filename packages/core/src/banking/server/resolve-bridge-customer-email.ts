import 'server-only';

import {
  bridgeGetCustomer,
  bridgeGetKycLink,
} from '../../common/server/bridge-client';
import type { BankCustomer } from '@hypha-platform/storage-postgres';

import { BankOnboardingError } from './errors';

function readEmailFromRecord(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const email = (value as Record<string, unknown>).email;
  if (typeof email !== 'string') {
    return null;
  }
  const trimmed = email.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Email for Bridge KYC/Persona flows — read from Bridge only (not Hypha DB).
 */
export async function resolveBridgeCustomerEmail(
  customer: Pick<BankCustomer, 'providerKycLinkId' | 'providerCustomerId'>,
): Promise<string> {
  const kycLink = await bridgeGetKycLink(customer.providerKycLinkId);
  const fromLink = readEmailFromRecord(kycLink);
  if (fromLink) {
    return fromLink;
  }

  const customerId = customer.providerCustomerId ?? kycLink.customer_id ?? null;

  if (customerId) {
    const bridgeCustomer = await bridgeGetCustomer(customerId);
    const fromCustomer = readEmailFromRecord(bridgeCustomer);
    if (fromCustomer) {
      return fromCustomer;
    }
  }

  throw new BankOnboardingError(
    'Could not resolve contact email from Bridge. Complete base verification first.',
    422,
  );
}
