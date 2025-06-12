import { publicClient } from '@core/common/web3/public-client';
import { erc20Abi, getContract } from 'viem';

export async function getBalance(
  tokenAddress: `0x${string}`,
  ownerAddress: `0x${string}`,
): Promise<bigint> {
  const contract = getContract({
    address: tokenAddress,
    abi: erc20Abi,
    client: publicClient,
  });

  try {
    return await contract.read.balanceOf([ownerAddress]);
  } catch (error: any) {
    console.error(
      `Failed to fetch balance of ${ownerAddress} for token ${tokenAddress}:`,
      error,
    );
    throw new Error(`Could not retrieve balance: ${error.message}`);
  }
}
