const IBAN_ALPHA2_TO_ALPHA3: Record<string, string> = {
  AD: 'AND', AT: 'AUT', BE: 'BEL', BG: 'BGR', CH: 'CHE', CY: 'CYP',
  CZ: 'CZE', DE: 'DEU', DK: 'DNK', EE: 'EST', ES: 'ESP', FI: 'FIN',
  FR: 'FRA', GB: 'GBR', GI: 'GIB', GR: 'GRC', HR: 'HRV', HU: 'HUN',
  IE: 'IRL', IS: 'ISL', IT: 'ITA', LI: 'LIE', LT: 'LTU', LU: 'LUX',
  LV: 'LVA', MC: 'MCO', MT: 'MLT', NL: 'NLD', NO: 'NOR', PL: 'POL',
  PT: 'PRT', RO: 'ROU', SE: 'SWE', SI: 'SVN', SK: 'SVK', SM: 'SMR',
  VA: 'VAT',
};

import {
  bridgeCreateExternalAccount,
  bridgeCreateKycLink,
  bridgeCreateLiquidationAddress,
  bridgeCreateTransfer,
  bridgeCreateVirtualAccount,
  type BridgeCreateExternalAccountRequest,
  type BridgeCreateKycLinkRequest,
  type BridgeCreateLiquidationAddressRequest,
  type BridgeCreateTransferRequest,
} from '../../../../common/server/bridge-client';
import {
  BRIDGE_LIQUIDATION_SOURCE_CHAIN,
  getPaymentRailForCurrency,
  resolveBankPayoutRail,
} from '../../../constants';
import { BRIDGE_DEFAULT_DESTINATION_CURRENCY } from '../../../bridge-destination-currencies';
import type {
  BankKycProvider,
  CreateKycLinkInput,
  CreateKycLinkResult,
  CreateLiquidationAddressInput,
  CreateLiquidationAddressResult,
  CreateTransferInput,
  CreateTransferResult,
  ProvisionVirtualAccountInput,
  ProvisionVirtualAccountResult,
  RegisterExternalAccountInput,
  RegisterExternalAccountResult,
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

function readExternalAccountLast4(
  response: Awaited<ReturnType<typeof bridgeCreateExternalAccount>>,
): string | null {
  if (typeof response.last_4 === 'string') {
    return response.last_4;
  }
  const nested = response.account?.last_4;
  return typeof nested === 'string' ? nested : null;
}

function toBridgeExternalAccountBody(
  input: RegisterExternalAccountInput,
): BridgeCreateExternalAccountRequest {
  const rail = resolveBankPayoutRail(input.railKey);
  if (!rail) {
    throw new Error(`Unsupported payout rail: ${input.railKey}`);
  }

  const destinationCurrency =
    input.destinationCurrency?.toLowerCase() ?? rail.destinationCurrency;

  const { subdivision, ...restAddress } = input.address;
  const body: BridgeCreateExternalAccountRequest = {
    currency: destinationCurrency,
    account_type: rail.externalAccountType,
    bank_name: input.bankName,
    account_name: input.accountName,
    account_owner_name: input.accountOwnerName,
    account_owner_type: input.accountOwnerType,
    address: {
      ...restAddress,
      ...(subdivision ? { state: subdivision } : {}),
    },
  };

  if (input.accountOwnerType === 'business' && input.businessName) {
    body.business_name = input.businessName;
  }

  if (rail.externalAccountType === 'us') {
    body.account = {
      routing_number: input.routingNumber,
      account_number: input.accountNumber,
      checking_or_savings: input.checkingOrSavings ?? 'checking',
    };
  } else if (rail.externalAccountType === 'iban') {
    const ibanAlpha2 = input.iban!.replace(/\s/g, '').toUpperCase().slice(0, 2);
    const ibanAlpha3 = IBAN_ALPHA2_TO_ALPHA3[ibanAlpha2];
    if (!ibanAlpha3) {
      throw new Error(`Unsupported IBAN country prefix: ${ibanAlpha2}`);
    }
    body.iban = {
      account_number: input.iban!,
      ...(input.bic ? { bic: input.bic } : {}),
      country: ibanAlpha3,
    };
  } else if (rail.externalAccountType === 'gb') {
    body.account = {
      sort_code: input.sortCode,
      account_number: input.accountNumber,
    };
  } else if (rail.externalAccountType === 'swift') {
    // SWIFT requires a nested `swift: { account, address, category, purpose_of_funds, short_business_description }`
    // body — not yet fully implemented. bic passed top-level as a best-effort placeholder.
    body.bic = input.bic;
    if (input.accountNumber) {
      body.account = { account_number: input.accountNumber };
    }
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

      const destinationCurrency =
        input.destinationCurrency ?? BRIDGE_DEFAULT_DESTINATION_CURRENCY;

      const response = await bridgeCreateVirtualAccount(
        input.customerId,
        {
          source: { currency: input.currency },
          destination: {
            payment_rail: 'base',
            currency: destinationCurrency,
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
      const destinationCurrency =
        input.destinationCurrency ?? BRIDGE_DEFAULT_DESTINATION_CURRENCY;

      const body: BridgeCreateTransferRequest = {
        on_behalf_of: input.customerId,
        source: {
          payment_rail: input.paymentRail,
          currency: input.currency,
        },
        destination: {
          payment_rail: 'base',
          currency: destinationCurrency,
          to_address: input.destinationAddress,
        },
      };

      if (input.amount) {
        body.amount = input.amount;
        body.developer_fee = '0.0';
      } else {
        body.features = { flexible_amount: true };
        body.developer_fee_percent = '0.0';
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
            : typeof response.developer_fee === 'string'
            ? response.developer_fee
            : null,
        destination: {
          currency: response.destination?.currency ?? 'usdc',
          paymentRail: response.destination?.payment_rail ?? 'base',
          address: destinationAddress,
        },
      };
    },
    async registerExternalAccount(
      input: RegisterExternalAccountInput,
    ): Promise<RegisterExternalAccountResult> {
      const rail = resolveBankPayoutRail(input.railKey);
      if (!rail) {
        throw new Error(`Unsupported payout rail: ${input.railKey}`);
      }

      const body = toBridgeExternalAccountBody(input);
      const response = await bridgeCreateExternalAccount(
        input.customerId,
        body,
        input.idempotencyKey,
      );

      const destinationCurrency =
        input.destinationCurrency?.toLowerCase() ?? rail.destinationCurrency;

      return {
        providerExternalAccountId: response.id,
        currency: response.currency?.toLowerCase() ?? destinationCurrency,
        paymentRail: rail.destinationPaymentRail,
        active: response.active ?? true,
        accountLast4: readExternalAccountLast4(response),
        bankName: response.bank_name ?? input.bankName,
        accountOwnerName: response.account_owner_name ?? input.accountOwnerName,
      };
    },
    async createLiquidationAddress(
      input: CreateLiquidationAddressInput,
    ): Promise<CreateLiquidationAddressResult> {
      const body: BridgeCreateLiquidationAddressRequest = {
        chain: BRIDGE_LIQUIDATION_SOURCE_CHAIN,
        currency: input.sourceCurrency.toLowerCase(),
        external_account_id: input.externalAccountId,
        destination_payment_rail: input.destinationPaymentRail,
        destination_currency: input.destinationCurrency.toLowerCase(),
      };

      if (input.wireMessage) {
        body.destination_wire_message = input.wireMessage;
      }

      const response = await bridgeCreateLiquidationAddress(
        input.customerId,
        body,
        input.idempotencyKey,
      );

      return {
        providerLiquidationAddressId: response.id,
        evmAddress: response.address,
        sourceCurrency: response.currency.toLowerCase(),
        sourceChain: response.chain,
        destinationPaymentRail:
          response.destination_payment_rail ?? input.destinationPaymentRail,
        destinationCurrency:
          response.destination_currency?.toLowerCase() ??
          input.destinationCurrency.toLowerCase(),
        state: response.state ?? 'active',
      };
    },
  };
}
