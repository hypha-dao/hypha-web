import { publicClient } from '@hypha-platform/core/client';
import { erc20Abi, formatUnits } from 'viem';
import { getEnergyCommunityToken } from './energy-community-tokens';

export async function getBalance(
  tokenAddress: `0x${string}`,
  ownerAddress: `0x${string}`,
): Promise<{ amount: number; symbol: string }> {
  const contract = {
    abi: erc20Abi,
    address: tokenAddress,
  };

  try {
    const [amount, decimals, symbol] = await publicClient.multicall({
      blockTag: 'safe',
      contracts: [
        {
          ...contract,
          functionName: 'balanceOf',
          args: [ownerAddress],
        },
        {
          ...contract,
          functionName: 'decimals',
          args: [],
        },
        {
          ...contract,
          functionName: 'symbol',
          args: [],
        },
      ],
    });

    const failure = [amount, decimals, symbol].find(
      (item) => item.status === 'failure',
    );
    if (failure) {
      throw failure.error;
    }

    const catalogue = getEnergyCommunityToken(tokenAddress);
    const contractDecimals = decimals.result as number;
    const displayDecimals =
      catalogue?.balanceDisplayDecimals !== undefined
        ? catalogue.balanceDisplayDecimals
        : contractDecimals;

    // Result fields will always be valid because of the check above
    return {
      amount: +formatUnits(amount.result as bigint, displayDecimals),
      symbol: symbol.result as string,
    };
  } catch (error: any) {
    console.error(
      `Failed to fetch balance of ${ownerAddress} for token ${tokenAddress}:`,
      error,
    );
    throw new Error(`Could not retrieve balance: ${error.message}`);
  }
}
