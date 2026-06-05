import {
  bridgeGetCustomer,
  bridgeUpdateCustomer,
  type BridgeCustomerAddress,
  type BridgeGetCustomerResponse,
  type BridgeUpdateCustomerRequest,
} from '../../common/server/bridge-client';

/** Full mock address for Bridge sandbox (Address2025WinterRefresh). */
export const BRIDGE_SANDBOX_MOCK_COMPLETE_ADDRESS: BridgeCustomerAddress = {
  street_line_1: '123 Main Street',
  street_line_2: 'Apt 4B',
  city: 'San Francisco',
  subdivision: 'CA',
  postal_code: '94103',
  country: 'USA',
};

function isCompleteAddress(
  address: BridgeCustomerAddress | null | undefined,
): boolean {
  if (!address) {
    return false;
  }

  return Boolean(
    address.street_line_1?.trim() &&
      address.city?.trim() &&
      address.country?.trim() &&
      address.subdivision?.trim() &&
      address.postal_code?.trim(),
  );
}

export function buildBridgeSandboxCustomerAddressUpdate(
  bridgeCustomerType: BridgeGetCustomerResponse['type'],
  businessLegalName?: string,
): BridgeUpdateCustomerRequest {
  if (bridgeCustomerType === 'individual') {
    return {
      type: 'individual',
      residential_address: BRIDGE_SANDBOX_MOCK_COMPLETE_ADDRESS,
    };
  }

  return {
    type: 'business',
    physical_address: BRIDGE_SANDBOX_MOCK_COMPLETE_ADDRESS,
    registered_address: BRIDGE_SANDBOX_MOCK_COMPLETE_ADDRESS,
    ...(businessLegalName ? { business_legal_name: businessLegalName } : {}),
  };
}

/**
 * Sandbox-only: applies mock KYB-related customer data on Bridge (address today).
 * Uses the customer type from Bridge so business always gets `physical_address`.
 */
export async function simulateBridgeKybData(
  customerId: string,
  options?: { businessLegalName?: string; force?: boolean },
): Promise<void> {
  const remote = await bridgeGetCustomer(customerId);

  const needsPhysicalAddress =
    remote.type === 'business' && !isCompleteAddress(remote.physical_address);
  const needsResidentialAddress =
    remote.type === 'individual' &&
    !isCompleteAddress(remote.residential_address);

  if (!options?.force && !needsPhysicalAddress && !needsResidentialAddress) {
    return;
  }

  const payload = buildBridgeSandboxCustomerAddressUpdate(
    remote.type,
    options?.businessLegalName,
  );

  await bridgeUpdateCustomer(customerId, payload);
}
