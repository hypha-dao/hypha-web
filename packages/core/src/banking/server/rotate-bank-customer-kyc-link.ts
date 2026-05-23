import 'server-only';

import type {
  BankCustomer,
  BankCustomerPreviousKycLink,
} from '@hypha-platform/storage-postgres';
import type { BridgeCreateKycLinkResponse } from '../../common/server/bridge-client';
import type { DatabaseInstance } from '../../common/server/types';
import type { BridgeEndorsement } from './providers/bridge/endorsements';
import { mapBridgeKycLinkUrls } from './providers/bridge/kyc-link-urls';
import { updateBankCustomerKycSession } from './mutations';

export async function rotateBankCustomerKycLink(
  customer: BankCustomer,
  newKycLink: BridgeCreateKycLinkResponse,
  endorsement: BridgeEndorsement,
  { db }: { db: DatabaseInstance },
): Promise<BankCustomer> {
  const archivedEntry: BankCustomerPreviousKycLink = {
    providerKycLinkId: customer.providerKycLinkId,
    kycLink: customer.kycLink,
    tosLink: customer.tosLink,
    kycStatus: customer.kycStatus,
    tosStatus: customer.tosStatus,
    endorsements: [...customer.endorsements],
    archivedAt: new Date().toISOString(),
  };

  const previousKycLinks = [
    ...(customer.previousKycLinks ?? []),
    archivedEntry,
  ];
  const endorsements = [...customer.endorsements];
  if (!endorsements.includes(endorsement)) {
    endorsements.push(endorsement);
  }

  const { kycLink, tosLink } = mapBridgeKycLinkUrls(newKycLink);

  return updateBankCustomerKycSession(
    {
      id: customer.id,
      providerKycLinkId: newKycLink.id,
      providerCustomerId: newKycLink.customer_id ?? customer.providerCustomerId,
      kycLink,
      tosLink,
      kycStatus: newKycLink.kyc_status,
      tosStatus: newKycLink.tos_status ?? null,
      endorsements,
      previousKycLinks,
    },
    { db },
  );
}
