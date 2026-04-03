import {
  getPriceCurrencyCode,
  type TokenUpdateData,
  type TransferWhitelistFormValue,
  isTokenUpdateData,
  sanitizeTokenPriceReferenceCurrency,
} from '@hypha-platform/core/client';
import type { Dispatch, SetStateAction } from 'react';
import type { UseFormSetValue, FieldValues } from 'react-hook-form';
import { normalizeMaxSupplyHuman } from '../treasury/utils/normalize-max-supply-human';

/** Field on `resubmitProposalData` JSON — avoids a second sessionStorage key race with the plugin. */
export const RESUBMIT_UPDATE_ISSUED_TOKEN_EMBEDDED_FIELD =
  'updateIssuedTokenResubmitPayload' as const;

export const UPDATE_ISSUED_TOKEN_RESUBMIT_EVENT =
  'hypha:apply-update-token-resubmit' as const;

type ApplyUpdateIssuedTokenResubmitCtx<T extends FieldValues> = {
  setValue: UseFormSetValue<T>;
  setTokenType: (type: string) => void;
  setShowAdvancedSettings: Dispatch<SetStateAction<boolean>>;
  setShowDecaySettings: Dispatch<SetStateAction<boolean>>;
};

/**
 * Applies withdraw/resubmit payload to the update-issued-token form (shared by plugin + resubmit hook).
 */
export function applyUpdateIssuedTokenResubmitPayloadToForm<
  T extends FieldValues,
>(
  payload: UpdateIssuedTokenResubmitPayload,
  {
    setValue,
    setTokenType,
    setShowAdvancedSettings,
    setShowDecaySettings,
  }: ApplyUpdateIssuedTokenResubmitCtx<T>,
): void {
  const patch = (
    name: string,
    value: unknown,
    options?: { shouldDirty?: boolean; shouldValidate?: boolean },
  ) =>
    setValue(name as never, value as never, {
      shouldDirty: options?.shouldDirty ?? true,
      shouldValidate: options?.shouldValidate ?? false,
      ...options,
    });

  patch('name', payload.name);
  patch('symbol', payload.symbol);
  if (payload.type) {
    patch('type', payload.type);
    setTokenType(payload.type);
  }
  if (payload.iconUrl !== undefined) {
    patch('iconUrl', payload.iconUrl);
    setValue('initialIconUrl' as never, payload.iconUrl as never, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }
  patch('enableLimitedSupply', payload.enableLimitedSupply, {
    shouldDirty: false,
  });
  patch('maxSupply', normalizeMaxSupplyHuman(payload.maxSupply ?? 0), {
    shouldDirty: false,
  });
  if (payload.maxSupplyType) {
    patch('maxSupplyType', payload.maxSupplyType, { shouldDirty: false });
  }
  if (payload.transferable !== undefined) {
    patch('transferable', payload.transferable);
  }
  patch('isVotingToken', payload.isVotingToken);
  patch('decaySettings', payload.decaySettings);
  patch('enableProposalAutoMinting', payload.enableProposalAutoMinting);
  const safeRef = sanitizeTokenPriceReferenceCurrency(
    payload.referenceCurrency,
  );
  if (payload.enableTokenPrice && safeRef) {
    patch('enableTokenPrice', true);
    patch('tokenPrice', payload.tokenPrice);
    patch('referenceCurrency', safeRef);
  } else {
    patch('enableTokenPrice', false);
    patch('tokenPrice', undefined);
    patch('referenceCurrency', undefined);
  }
  patch(
    'enableAdvancedTransferControls',
    payload.enableAdvancedTransferControls,
  );
  if (payload.transferWhitelist !== undefined) {
    patch('transferWhitelist', payload.transferWhitelist, {
      shouldDirty: false,
    });
  }
  patch('archiveToken', payload.archiveToken);

  const showAdv =
    payload.enableLimitedSupply ||
    payload.enableTokenPrice ||
    payload.enableAdvancedTransferControls ||
    !payload.enableProposalAutoMinting ||
    (payload.type === 'voice' &&
      (payload.decaySettings.decayInterval !== 2592000 ||
        payload.decaySettings.decayPercentage !== 1));
  setShowAdvancedSettings(showAdv);

  if (
    payload.type === 'voice' &&
    (payload.decaySettings.decayInterval !== 2592000 ||
      payload.decaySettings.decayPercentage !== 1)
  ) {
    setShowDecaySettings(true);
  }
}

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
  if (v > BigInt(Number.MAX_SAFE_INTEGER)) {
    return undefined;
  }
  if (v < BigInt(Number.MIN_SAFE_INTEGER)) {
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
  if (dbRow && isTokenUpdateData(dbRow.data)) {
    const data = dbRow.data;
    const priceRef = sanitizeTokenPriceReferenceCurrency(
      data.referenceCurrency,
    );
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
      enableProposalAutoMinting:
        data.enableProposalAutoMinting ?? snapshot?.autoMinting ?? true,
      enableTokenPrice: !!(data.referencePrice && priceRef),
      tokenPrice: data.referencePrice,
      referenceCurrency: priceRef,
      enableAdvancedTransferControls:
        data.enableAdvancedTransferControls ??
        !!(
          data.transferWhitelist?.from?.length ||
          data.transferWhitelist?.to?.length ||
          data.useTransferWhitelist ||
          data.useReceiveWhitelist ||
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
  const referenceCurrency = sanitizeTokenPriceReferenceCurrency(
    snapshot.priceWithCurrency
      ? getPriceCurrencyCode(
          snapshot.priceWithCurrency.priceCurrencyFeed as `0x${string}`,
        )
      : undefined,
  );

  const snapshotType =
    snapshot.fixedMaxSupply !== undefined && max > 0
      ? snapshot.fixedMaxSupply
        ? ('immutable' as const)
        : ('updatable' as const)
      : undefined;

  return {
    tokenAddress: snapshot.address as string,
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
    enableTokenPrice: !!snapshot.priceWithCurrency && !!referenceCurrency,
    tokenPrice,
    referenceCurrency,
    enableAdvancedTransferControls: !!(
      snapshot.useTransferWhitelist || snapshot.useReceiveWhitelist
    ),
    archiveToken: snapshot.archiveToken ?? false,
  };
}
