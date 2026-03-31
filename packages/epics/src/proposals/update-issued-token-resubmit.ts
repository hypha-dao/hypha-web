import type { TokenUpdateData } from '@hypha-platform/core/client';
import { getPriceCurrencyCode } from '@hypha-platform/core/client';

/** sessionStorage key for resubmit payload (must match form-voting + plugin). */
export const RESUBMIT_UPDATE_ISSUED_TOKEN_FORM_KEY =
  'resubmitUpdateIssuedTokenForm';

export type UpdateTokenProposalSnapshot = {
  address?: `0x${string}`;
  name?: string;
  symbol?: string;
  maxSupply?: bigint;
  transferable?: boolean;
  autoMinting?: boolean;
  priceWithCurrency?: {
    tokenPrice: bigint;
    priceCurrencyFeed: string;
  };
  decayPercentage?: bigint;
  decayInterval?: bigint;
  useTransferWhitelist?: boolean;
  useReceiveWhitelist?: boolean;
  archiveToken?: boolean;
};

export type UpdateIssuedTokenResubmitPayload = {
  tokenAddress: string;
  name: string;
  symbol: string;
  type?: TokenUpdateData['type'];
  iconUrl?: string;
  maxSupply: number;
  enableLimitedSupply: boolean;
  transferable?: boolean;
  isVotingToken: boolean;
  decaySettings: { decayInterval: number; decayPercentage: number };
  enableProposalAutoMinting: boolean;
  enableTokenPrice: boolean;
  tokenPrice?: number;
  referenceCurrency?: TokenUpdateData['referenceCurrency'];
  enableAdvancedTransferControls: boolean;
  archiveToken: boolean;
};

export type TokenUpdateDbRow = {
  tokenAddress: string;
  data: unknown;
};

function bigintToNumber(v: bigint | undefined): number | undefined {
  if (v === undefined) {
    return undefined;
  }
  return Number(v);
}

export function buildUpdateIssuedTokenResubmitPayload({
  dbRow,
  snapshot,
}: {
  dbRow: TokenUpdateDbRow | null;
  snapshot?: UpdateTokenProposalSnapshot | null;
}): UpdateIssuedTokenResubmitPayload | null {
  if (dbRow) {
    const data = dbRow.data as TokenUpdateData;
    const max = data.maxSupply ?? 0;
    return {
      tokenAddress: dbRow.tokenAddress,
      name: data.name ?? '',
      symbol: data.symbol ?? '',
      type: data.type,
      iconUrl: typeof data.iconUrl === 'string' ? data.iconUrl : undefined,
      maxSupply: max,
      enableLimitedSupply: max > 0,
      transferable: data.transferable,
      isVotingToken: data.isVotingToken ?? data.type === 'voice',
      decaySettings: {
        decayInterval: data.decayInterval ?? 2592000,
        decayPercentage: data.decayPercentage ?? 1,
      },
      enableProposalAutoMinting: snapshot?.autoMinting ?? true,
      enableTokenPrice: !!(data.referencePrice && data.referenceCurrency),
      tokenPrice: data.referencePrice,
      referenceCurrency: data.referenceCurrency,
      enableAdvancedTransferControls: !!(
        snapshot?.useTransferWhitelist || snapshot?.useReceiveWhitelist
      ),
      archiveToken: data.archiveToken ?? false,
    };
  }

  if (!snapshot?.address) {
    return null;
  }

  const max = bigintToNumber(snapshot.maxSupply) ?? 0;
  const tokenPrice = snapshot.priceWithCurrency
    ? Number(snapshot.priceWithCurrency.tokenPrice) / 1_000_000
    : undefined;
  const referenceCurrency = snapshot.priceWithCurrency
    ? getPriceCurrencyCode(
        snapshot.priceWithCurrency.priceCurrencyFeed as `0x${string}`,
      )
    : undefined;

  return {
    tokenAddress: snapshot.address,
    name: snapshot.name ?? '',
    symbol: snapshot.symbol ?? '',
    maxSupply: max,
    enableLimitedSupply: max > 0,
    transferable: snapshot.transferable,
    isVotingToken: false,
    decaySettings: {
      decayInterval: bigintToNumber(snapshot.decayInterval) ?? 2592000,
      decayPercentage: bigintToNumber(snapshot.decayPercentage) ?? 1,
    },
    enableProposalAutoMinting: snapshot.autoMinting ?? true,
    enableTokenPrice: !!snapshot.priceWithCurrency,
    tokenPrice,
    referenceCurrency,
    enableAdvancedTransferControls: !!(
      snapshot.useTransferWhitelist || snapshot.useReceiveWhitelist
    ),
    archiveToken: snapshot.archiveToken ?? false,
  };
}
