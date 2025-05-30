import { PublicClient, Hex } from 'viem';
import { ERC20 } from './_abis';

export type Asset = {
  symbol: string;
  amount: bigint;
  decimals: number;
}

// Get ETH balance of an owner
//
// Params:
// client - client to make a request
export async function getEthBalance(
  client: PublicClient,
  owner: Hex,
): Promise<Asset> {
  const balance = await client.getBalance({
    blockTag: 'safe',
    address: owner,
  })
  // FIXME: this should not be hardcoded
  return {
    symbol: "ETH",
    amount: balance,
    decimals: 18,
  }
}

// Get balance of owner on a ERC20 token contract
//
// Params:
// client - client to make a request
// owner - owner of balance
// token - address of token contract
export async function getERC20Balance(
  client: PublicClient,
  owner: Hex,
  token: Hex,
): Promise<Asset> {
  const contract = {
    address: token,
    abi: ERC20,
  } as const;

  const result = await client.multicall({
    contracts: [
      {
        ...contract,
        functionName: 'balanceOf',
        args: [owner],
      },
      {
        ...contract,
        functionName: 'symbol',
      },
      {
        ...contract,
        functionName: 'decimals',
      }
    ]
  })
  if (result.some(res => res.status === "failure")) {
    throw result.find(res => res.status === "failure")?.error ||
      new Error(`Fetching balance of ${owner} on ${token}`);
  }

  const [amount, symbol, decimals] = result;
  return {
    // FIXME: make a better conversion
    symbol: symbol.result! as string,
    amount: amount.result! as bigint,
    decimals: decimals.result! as number
  }
}
