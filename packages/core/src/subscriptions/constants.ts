/**
 * On-chain subscription pricing mirrors HyphaToken.USDC_PER_DAY (367_000,
 * 6 decimals = $0.367/day). One Stripe billing cycle buys 30 days, so the
 * settlement amount must be at least 30 * USDC_PER_DAY or the contract
 * rounds the duration down to 29 days.
 */
export const SUBSCRIPTION_USDC_PER_DAY = 367_000n;
export const SUBSCRIPTION_DAYS_PER_CYCLE = 30n;
export const SUBSCRIPTION_USDC_PER_CYCLE =
  SUBSCRIPTION_USDC_PER_DAY * SUBSCRIPTION_DAYS_PER_CYCLE; // 11.01 USDC

/** USDC on Base. */
export const SUBSCRIPTION_USDC_ADDRESS =
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

export const BASE_CHAIN_ID = 8453;
