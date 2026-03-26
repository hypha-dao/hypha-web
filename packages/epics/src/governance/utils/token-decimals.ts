const TOKEN_DECIMALS_BY_ADDRESS: Record<string, number> = {
  // USDC (Base)
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 6,
  // USDC (test/development deployment)
  '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42': 6,
  // cbBTC (Base)
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': 8,
};

export const resolveTokenDecimals = (tokenAddress?: string) => {
  if (!tokenAddress) return 18;
  return TOKEN_DECIMALS_BY_ADDRESS[tokenAddress.toLowerCase()] ?? 18;
};

export const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000' as const;
