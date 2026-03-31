import type {
  TokenUpdateData,
  TransferWhitelistFormValue,
} from '@hypha-platform/core/client';
import { getPriceCurrencyCode } from '@hypha-platform/core/client';

/** sessionStorage key for resubmit payload (must match form-voting + plugin). */
export const RESUBMIT_UPDATE_ISSUED_TOKEN_FORM_KEY =
  'resubmitUpdateIssuedTokenForm';

export type UpdateTokenProposalSnapshot = {
  address?: `0x${string}`;
  name?: string;
  symbol?: string;
  maxSupply?: bigint;
  /** From token `initialize` calldata when decoded (immutable = true) */
  fixedMaxSupply?: boolean;
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

const MAX_SUPPLY_TYPE_LABEL: Record<'immutable' | 'updatable', string> = {
  immutable: 'Forever Immutable',
  updatable: 'Updatable Over Time',
};

export type UpdateIssuedTokenResubmitPayload = {
  tokenAddress: string;
  name: string;
  symbol: string;
  type?: TokenUpdateData['type'];
  iconUrl?: string;
  maxSupply: number;
  enableLimitedSupply: boolean;
  maxSupplyType?: { label: string; value: 'immutable' | 'updatable' };
  transferable?: boolean;
  isVotingToken: boolean;
  decaySettings: { decayInterval: number; decayPercentage: number };
  enableProposalAutoMinting: boolean;
  enableTokenPrice: boolean;
  tokenPrice?: number;
  referenceCurrency?: TokenUpdateData['referenceCurrency'];
  enableAdvancedTransferControls: boolean;
  archiveToken: boolean;
  transferWhitelist?: TransferWhitelistFormValue;
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
    const fromDbType = data.maxSupplyTypeValue;
    const fromSnapshot =
      snapshot?.fixedMaxSupply !== undefined
        ? snapshot.fixedMaxSupply
          ? ('immutable' as const)
          : ('updatable' as const)
        : undefined;
    const resolvedValue = fromDbType ?? fromSnapshot;
    return {
      tokenAddress: dbRow.tokenAddress,
      name: data.name ?? '',
      symbol: data.symbol ?? '',
      type: data.type,
      iconUrl: typeof data.iconUrl === 'string' ? data.iconUrl : undefined,
      maxSupply: max,
      enableLimitedSupply: max > 0,
      ...(resolvedValue && max > 0
        ? {
            maxSupplyType: {
              label: MAX_SUPPLY_TYPE_LABEL[resolvedValue],
              value: resolvedValue,
            },
          }
        : {}),
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
        data.transferWhitelist?.from?.length ||
        data.transferWhitelist?.to?.length ||
        snapshot?.useTransferWhitelist ||
        snapshot?.useReceiveWhitelist
      ),
      archiveToken: data.archiveToken ?? false,
      ...(data.transferWhitelist
        ? { transferWhitelist: data.transferWhitelist }
        : {}),
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

  const snapshotType =
    snapshot.fixedMaxSupply !== undefined && max > 0
      ? snapshot.fixedMaxSupply
        ? ('immutable' as const)
        : ('updatable' as const)
      : undefined;

  return {
    tokenAddress: snapshot.address,
    name: snapshot.name ?? '',
    symbol: snapshot.symbol ?? '',
    maxSupply: max,
    enableLimitedSupply: max > 0,
    ...(snapshotType
      ? {
          maxSupplyType: {
            label: MAX_SUPPLY_TYPE_LABEL[snapshotType],
            value: snapshotType,
          },
        }
      : {}),
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
