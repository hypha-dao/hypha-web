import {
  bridgeCreateKycLink,
  bridgeCreateVirtualAccount,
  type BridgeCreateKycLinkRequest,
} from '../../../../common/server/bridge-client';
import { getPaymentRailForCurrency } from '../../../constants';
import type {
  BankKycProvider,
  CreateKycLinkInput,
  CreateKycLinkResult,
  ProvisionVirtualAccountInput,
  ProvisionVirtualAccountResult,
} from '../types';
import { resolveBridgeKycEndorsements } from './endorsements';

function toBridgeCreateKycLinkBody(
  input: CreateKycLinkInput,
): BridgeCreateKycLinkRequest {
  const body: BridgeCreateKycLinkRequest = {
    full_name: input.legalName,
    email: input.contactEmail,
    type: input.entityType,
  };

  body.endorsements = resolveBridgeKycEndorsements(input.endorsements);

  if (input.redirectUri) {
    body.redirect_uri = input.redirectUri;
  }

  return body;
}

export function createBridgeKycProvider(): BankKycProvider {
  return {
    provider: 'bridge',
    async createKycLink(
      input: CreateKycLinkInput,
    ): Promise<CreateKycLinkResult> {
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
    async provisionVirtualAccount(
      input: ProvisionVirtualAccountInput,
    ): Promise<ProvisionVirtualAccountResult> {
      const paymentRail = getPaymentRailForCurrency(input.currency);
      if (!paymentRail) {
        throw new Error(
          `Unsupported virtual account currency: ${input.currency}`,
        );
      }

      const response = await bridgeCreateVirtualAccount(
        input.customerId,
        {
          source: { currency: input.currency },
          destination: {
            payment_rail: 'base',
            currency: 'usdc',
            address: input.destinationAddress,
          },
        },
        input.idempotencyKey,
      );

      const instructions = response.source_deposit_instructions;
      const currency =
        response.source?.currency ??
        (typeof instructions.currency === 'string'
          ? instructions.currency
          : input.currency);

      const paymentRails = instructions.payment_rails;
      const responseRail =
        response.source?.payment_rail ??
        (Array.isArray(paymentRails) && typeof paymentRails[0] === 'string'
          ? paymentRails[0]
          : paymentRail);

      return {
        providerVirtualAccountId: response.id,
        currency,
        paymentRail: responseRail,
        depositInstructions: instructions,
        status: response.status,
      };
    },
  };
}
