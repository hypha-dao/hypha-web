'use client';

import useSWR from 'swr';
import { publicClient } from '../../../client';
import { decayingSpaceTokenAbi } from '../../../generated';
import { UpdateIssuedTokenInput } from './useUpdateIssuedTokenMutations.web3.rpc';

const DECIMALS = 18n;

async function fetchTokenOnChainData(
  address: `0x${string}`,
): Promise<Partial<UpdateIssuedTokenInput>> {
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
    ],
  });

  for (const failure of results.filter(
    (result) => result.status === 'failure',
  )) {
    console.error(`Contract call failed: ${failure.error.message}`);
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
  ] = results.map(({ result }) => result);

  return {
    name: nameResult as string,
    symbol: symbolResult as string,
    maxSupply:
      maxSupplyResult !== undefined
        ? Number((maxSupplyResult as bigint) / 10n ** DECIMALS)
        : undefined,
    transferable: transferableResult as boolean,
    autoMinting: autoMintingResult as boolean,
    tokenPrice:
      tokenPriceResult !== undefined
        ? Number(tokenPriceResult as bigint)
        : undefined,
    priceCurrencyFeed: priceCurrencyFeedResult as `0x${string}`,
    decayPercentage:
      decayPercentageResult !== undefined
        ? Number(decayPercentageResult as bigint)
        : undefined,
    decayInterval:
      decayRateResult !== undefined
        ? Number(decayRateResult as bigint)
        : undefined,
    useTransferWhitelist: useTransferWhitelistResult as boolean,
    useReceiveWhitelist: useReceiveWhitelistResult as boolean,
    archiveToken: archivedResult as boolean,
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
