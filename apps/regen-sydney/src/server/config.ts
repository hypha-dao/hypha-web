import 'server-only';

import { isAddress } from 'viem';

/**
 * Every environment-dependent knob in one place. Nothing here throws at import
 * time — a missing relayer key or payment provider degrades a single feature
 * rather than taking the whole app down, which matters because the campaign
 * has to keep accepting sign-ins while the on-chain and checkout pieces are
 * still being provisioned.
 */

function str(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim();
}

function num(name: string, fallback: number): number {
  const raw = str(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const appUrl = str('NEXT_PUBLIC_APP_URL', 'http://localhost:3002');

export const campaignConfig = {
  /** RSUT minted once, on a person's first sign-in. */
  joinBonusRsut: num('CAMPAIGN_JOIN_BONUS_RSUT', 50),
  /** RSUT granted per A$1 contributed. */
  rsutPerAud: num('CAMPAIGN_RSUT_PER_AUD', 1),
  /** Smallest contribution the checkout will create, in whole dollars. */
  minContributionAud: num('CAMPAIGN_MIN_CONTRIBUTION_AUD', 5),
  maxContributionAud: num('CAMPAIGN_MAX_CONTRIBUTION_AUD', 25000),
};

/**
 * Admins are identified by the email on their Privy login. Checked server-side
 * on every admin route — the hidden UI is a convenience, not the control.
 */
export function getAdminEmails(): string[] {
  return str('CAMPAIGN_ADMIN_EMAILS')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export type RelayerConfig = {
  tokenAddress: `0x${string}`;
  privateKey: `0x${string}`;
  rpcUrl: string;
  chainId: number;
};

/**
 * Returns null when the relayer is not provisioned yet. Callers treat that as
 * "record the grant, skip the mint" rather than as an error.
 */
export function getRelayerConfig(): RelayerConfig | null {
  const tokenAddress = str('RSUT_TOKEN_ADDRESS');
  const privateKey = str('RSUT_RELAYER_PRIVATE_KEY');

  if (!tokenAddress || !privateKey) return null;
  if (!isAddress(tokenAddress)) {
    console.warn('RSUT_TOKEN_ADDRESS is not a valid address; minting disabled');
    return null;
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    console.warn('RSUT_RELAYER_PRIVATE_KEY is malformed; minting disabled');
    return null;
  }

  return {
    tokenAddress: tokenAddress as `0x${string}`,
    privateKey: privateKey as `0x${string}`,
    rpcUrl: str('RPC_URL', 'https://mainnet.base.org'),
    chainId: num('RSUT_CHAIN_ID', 8453),
  };
}

export const PAYMENT_PROVIDER_IDS = ['mock', 'paddle', 'stripe'] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDER_IDS)[number];

/**
 * Paddle or Stripe is still an open decision, so the provider is selected at
 * runtime and `mock` keeps the full contribute -> grant -> mint path testable
 * without either account existing.
 */
export function getPaymentProviderId(): PaymentProviderId {
  const configured = str('CAMPAIGN_PAYMENTS_PROVIDER', 'mock').toLowerCase();
  return (PAYMENT_PROVIDER_IDS as readonly string[]).includes(configured)
    ? (configured as PaymentProviderId)
    : 'mock';
}

export const paddleConfig = {
  apiKey: str('PADDLE_API_KEY'),
  webhookSecret: str('PADDLE_WEBHOOK_SECRET'),
  priceId: str('PADDLE_PRICE_ID'),
  environment: str('NEXT_PUBLIC_PADDLE_ENVIRONMENT', 'sandbox'),
  get apiBase() {
    return this.environment === 'production'
      ? 'https://api.paddle.com'
      : 'https://sandbox-api.paddle.com';
  },
};

export const stripeConfig = {
  secretKey: str('STRIPE_SECRET_KEY'),
  webhookSecret: str('STRIPE_WEBHOOK_SECRET'),
};
