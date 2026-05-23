import {
  bridgeCreateKycLink,
  bridgeCreateTransfer,
  bridgeCreateVirtualAccount,
  type BridgeCreateKycLinkRequest,
  type BridgeCreateTransferRequest,
} from '../../../../common/server/bridge-client';
import { getPaymentRailForCurrency } from '../../../constants';
import type {
  BankKycProvider,
  CreateKycLinkInput,
  CreateKycLinkResult,
  CreateTransferInput,
  CreateTransferResult,
  ProvisionVirtualAccountInput,
  ProvisionVirtualAccountResult,
} from '../types';
import { resolveBridgeKycEndorsements } from './endorsements';
import { mapBridgeKycLinkUrls } from './kyc-link-urls';

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
      const body = toBridgeCreateKycLinkBody(input);
      console.log('[banking] bridgeCreateKycLink request', {
        endorsements: body.endorsements,
        email: body.email,
        type: body.type,
      });

      const response = await bridgeCreateKycLink(body, input.idempotencyKey);

      const { kycLink, tosLink } = mapBridgeKycLinkUrls(response);

      return {
        providerCustomerId: response.customer_id ?? null,
        providerKycLinkId: response.id,
        kycStatus: response.kyc_status,
        isApproved: response.kyc_status === 'approved',
        tosStatus: response.tos_status ?? null,
        kycLink,
        tosLink,
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

      const destinationAddress =
        typeof response.destination?.address === 'string'
          ? response.destination.address
          : input.destinationAddress;

      return {
        providerVirtualAccountId: response.id,
        currency,
        paymentRail: responseRail,
        depositInstructions: instructions,
        status: response.status,
        developerFeePercent: response.developer_fee_percent ?? null,
        destination: {
          currency: response.destination?.currency ?? 'usdc',
          paymentRail: response.destination?.payment_rail ?? 'base',
          address: destinationAddress,
        },
      };
    },
    async createTransfer(
      input: CreateTransferInput,
    ): Promise<CreateTransferResult> {
      const body: BridgeCreateTransferRequest = {
        on_behalf_of: input.customerId,
        source: {
          payment_rail: input.paymentRail,
          currency: input.currency,
        },
        destination: {
          payment_rail: 'base',
          currency: 'usdc',
          to_address: input.destinationAddress,
        },
      };

      if (input.amount) {
        body.amount = input.amount;
      } else {
        body.features = { flexible_amount: true };
      }

      const response = await bridgeCreateTransfer(body, input.idempotencyKey);
      const instructions = response.source_deposit_instructions;
      const depositMessage =
        typeof instructions.deposit_message === 'string'
          ? instructions.deposit_message
          : '';

      if (!depositMessage) {
        throw new Error(
          'Bridge transfer response missing deposit_message in source_deposit_instructions',
        );
      }

      const currency =
        response.source?.currency ??
        (typeof instructions.currency === 'string'
          ? instructions.currency
          : input.currency);

      const paymentRail =
        response.source?.payment_rail ??
        (typeof instructions.payment_rail === 'string'
          ? instructions.payment_rail
          : input.paymentRail);

      const amount =
        response.amount ??
        (typeof instructions.amount === 'string' ? instructions.amount : null);

      const destinationAddress =
        response.destination?.to_address ?? input.destinationAddress;

      return {
        providerTransferId: response.id,
        currency,
        paymentRail,
        amount: amount ?? input.amount ?? null,
        depositMessage,
        depositInstructions: instructions,
        status: response.state,
        developerFeePercent:
          typeof response.developer_fee_percent === 'string'
            ? response.developer_fee_percent
            : null,
        destination: {
          currency: response.destination?.currency ?? 'usdc',
          paymentRail: response.destination?.payment_rail ?? 'base',
          address: destinationAddress,
        },
      };
    },
  };
}
