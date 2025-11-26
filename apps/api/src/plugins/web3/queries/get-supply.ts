import { type PublicClient, erc20Abi as abi } from 'viem';

export function getSupply(client: PublicClient, address: `0x${string}`) {
  return client.multicall({
    contracts: [
      {
        abi,
        address,
        functionName: 'totalSupply',
        args: [],
      },
    ],
  });
}
