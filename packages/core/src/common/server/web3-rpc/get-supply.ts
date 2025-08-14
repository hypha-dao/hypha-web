'use server';

import { ethers } from 'ethers';

const tokenAbi = [
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'maxSupply',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

interface TokenInterface {
  totalSupply: () => Promise<bigint>;
  maxSupply: () => Promise<bigint>;
}

export async function getSupply(
  address: `0x${string}`,
): Promise<{ totalSupply: bigint; maxSupply: bigint }> {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  if (!rpcUrl) {
    throw new Error('RPC_URL environment variable is required');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const token = new ethers.Contract(
    address,
    tokenAbi,
    provider,
  ) as ethers.Contract & TokenInterface;

  try {
    const [totalSupply, maxSupply] = await Promise.all([
      token.totalSupply(),
      token.maxSupply(),
    ]);
    return {
      totalSupply: totalSupply,
      maxSupply: maxSupply,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch supply for token ${address}: ${error}`);
  }
}
