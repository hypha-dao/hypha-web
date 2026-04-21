'use client';

import useSWR from 'swr';
import { formatUnits } from 'viem';
import { publicClient } from '../../../client';
import { decayingSpaceTokenAbi } from '../../../generated';
import type { UpdateIssuedTokenInput } from './build-update-issued-token-tx';
import { decayBasisPointsToFormPercent } from '../../voice-decay-units';

const DECIMALS = 18;
/** On-chain `tokenPrice` is stored in micro-units (1e6); UI uses human decimals */
const TOKEN_PRICE_MICRO = 1_000_000;

/**
 * Hydration shape for token edit forms — extends the on-chain input fields with
 * read-only credit metadata that the form needs but the tx builder does not
 * (the tx builder uses `batchAdd/RemoveCreditWhitelistSpaceIds` deltas instead).
 */
export type TokenOnChainData = Partial<UpdateIssuedTokenInput> & {
  /** Currently whitelisted space ids (web3 ids) — UI uses these as the baseline. */
  creditWhitelistedSpaceIds?: number[];
};

async function fetchTokenOnChainData(
  address: `0x${string}`,
): Promise<TokenOnChainData> {
  const contract = {
    address,
    abi: decayingSpaceTokenAbi,
  } as const;

  const results = await publicClient.multicall({
    allowFailure: true,
    blockTag: 'safe',
    contracts: [
      {
        ...contract,
        functionName: 'name',
        args: [],
      },
      {
        ...contract,
        functionName: 'symbol',
        args: [],
      },
      {
        ...contract,
        functionName: 'maxSupply',
        args: [],
      },
      {
        ...contract,
        functionName: 'transferable',
        args: [],
      },
      {
        ...contract,
        functionName: 'autoMinting',
        args: [],
      },
      {
        ...contract,
        functionName: 'tokenPrice',
        args: [],
      },
      {
        ...contract,
        functionName: 'priceCurrencyFeed',
        args: [],
      },
      {
        ...contract,
        functionName: 'decayPercentage',
        args: [],
      },
      {
        ...contract,
        functionName: 'decayRate',
        args: [],
      },
      {
        ...contract,
        functionName: 'useTransferWhitelist',
        args: [],
      },
      {
        ...contract,
        functionName: 'useReceiveWhitelist',
        args: [],
      },
      {
        ...contract,
        functionName: 'archived',
        args: [],
      },
      {
        ...contract,
        functionName: 'fixedMaxSupply',
        args: [],
      },
      {
        ...contract,
        functionName: 'defaultCreditLimit',
        args: [],
      },
      {
        ...contract,
        functionName: 'getCreditWhitelistedSpaces',
        args: [],
      },
    ],
  });

  for (const failure of results.filter(
    (result) => result.status === 'failure',
  )) {
    console.error(
      `Contract call failed for ${address}: ${failure.error.message}`,
    );
  }

  const [
    nameResult,
    symbolResult,
    maxSupplyResult,
    transferableResult,
    autoMintingResult,
    tokenPriceResult,
    priceCurrencyFeedResult,
    decayPercentageResult,
    decayRateResult,
    useTransferWhitelistResult,
    useReceiveWhitelistResult,
    archivedResult,
    fixedMaxSupplyResult,
    defaultCreditLimitResult,
    creditWhitelistedSpacesResult,
  ] = results.map(({ result }) => result);

  return {
    name: nameResult as string,
    symbol: symbolResult as string,
    maxSupply:
      maxSupplyResult !== undefined
        ? Number(formatUnits(maxSupplyResult as bigint, DECIMALS))
        : undefined,
    transferable: transferableResult as boolean,
    autoMinting: autoMintingResult as boolean,
    tokenPrice:
      tokenPriceResult !== undefined
        ? Number(tokenPriceResult as bigint) / TOKEN_PRICE_MICRO
        : undefined,
    priceCurrencyFeed: priceCurrencyFeedResult as `0x${string}`,
    decayPercentage:
      decayPercentageResult !== undefined
        ? decayBasisPointsToFormPercent(Number(decayPercentageResult as bigint))
        : undefined,
    decayInterval:
      decayRateResult !== undefined
        ? Number(decayRateResult as bigint)
        : undefined,
    useTransferWhitelist: useTransferWhitelistResult as boolean,
    useReceiveWhitelist: useReceiveWhitelistResult as boolean,
    archiveToken: archivedResult as boolean,
    fixedMaxSupply:
      fixedMaxSupplyResult !== undefined
        ? (fixedMaxSupplyResult as boolean)
        : undefined,
    defaultCreditLimit:
      defaultCreditLimitResult !== undefined
        ? Number(formatUnits(defaultCreditLimitResult as bigint, DECIMALS))
        : undefined,
    creditWhitelistedSpaceIds:
      creditWhitelistedSpacesResult !== undefined
        ? (creditWhitelistedSpacesResult as readonly bigint[]).map((v) => {
            if (v > BigInt(Number.MAX_SAFE_INTEGER)) {
              console.warn(
                `Credit-whitelisted space id ${v.toString()} for ${address} exceeds Number.MAX_SAFE_INTEGER; precision may be lost.`,
              );
            }
            return Number(v);
          })
        : undefined,
  };
}

export const useTokenOnChainData = (address?: `0x${string}`) => {
  const { data, isLoading, error } = useSWR(
    address ? [address, 'tokenOnChainData'] : null,
    ([addr]) => fetchTokenOnChainData(addr),
    {
      refreshInterval: 30000, // 30 seconds
    },
  );

  return {
    data,
    isLoading,
    error,
  };
};
