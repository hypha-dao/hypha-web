import { bridgeGetKycLink } from '../../common/server/bridge-client';
import type { DatabaseInstance } from '../../common/server/types';
import type { BankCustomer } from '@hypha-platform/storage-postgres';
import { BankOnboardingError } from './errors';
import { updateBankCustomer } from './mutations';

export async function resolveBridgeCustomerId(
  customer: BankCustomer,
  { db }: { db: DatabaseInstance },
): Promise<{ customerId: string; customer: BankCustomer }> {
  if (customer.providerCustomerId) {
    return { customerId: customer.providerCustomerId, customer };
  }

  if (!customer.providerKycLinkId) {
    throw new Error('Cannot resolve Bridge customer ID: KYC link ID not available');
  }
  const link = await bridgeGetKycLink(customer.providerKycLinkId);
  const customerId = link.customer_id ?? null;

  if (!customerId) {
    throw new BankOnboardingError(
      'Bridge customer ID is not available yet. Open the verification form once, then try again.',
      422,
    );
  }

  const updated = await updateBankCustomer(
    { id: customer.id, providerCustomerId: customerId },
    { db },
  );

  return { customerId, customer: updated };
}
