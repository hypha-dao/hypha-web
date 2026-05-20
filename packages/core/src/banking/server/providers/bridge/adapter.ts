import {
  bridgeCreateKycLink,
  type BridgeCreateKycLinkRequest,
} from '../../../../common/server/bridge-client';
import type {
  BankKycProvider,
  CreateKycLinkInput,
  CreateKycLinkResult,
} from '../types';
import { parseBridgeEndorsements } from './endorsements';

function toBridgeCreateKycLinkBody(
  input: CreateKycLinkInput,
): BridgeCreateKycLinkRequest {
  const body: BridgeCreateKycLinkRequest = {
    full_name: input.legalName,
    email: input.contactEmail,
    type: input.entityType,
  };

  if (input.endorsements?.length) {
    body.endorsements = parseBridgeEndorsements(input.endorsements);
  }

  if (input.redirectUri) {
    body.redirect_uri = input.redirectUri;
  }

  return body;
}

export function createBridgeKycProvider(): BankKycProvider {
  return {
    provider: 'bridge',
    async createKycLink(input: CreateKycLinkInput): Promise<CreateKycLinkResult> {
      const response = await bridgeCreateKycLink(
        toBridgeCreateKycLinkBody(input),
        input.idempotencyKey,
      );

      return {
        providerCustomerId: response.customer_id ?? null,
        providerKycLinkId: response.id,
        kycStatus: response.kyc_status,
        isApproved: response.kyc_status === 'approved',
        tosStatus: response.tos_status ?? null,
        kycLink: response.kyc_link,
        tosLink: response.tos_link ?? null,
      };
    },
  };
}
