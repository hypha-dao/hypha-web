import { Hex } from 'viem';
import { base } from 'viem/chains';

export type Token = {
  symbol: string;
  address: Hex;
};

export type ChainId = number;

export const TOKENS: Record<ChainId, Token[]> = {
  [base.id]: [
    { symbol: "USDC", address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" },
    { symbol: "EURC", address: "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42" },
    { symbol: "WBTC", address: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c" },
  ],
} as const;
