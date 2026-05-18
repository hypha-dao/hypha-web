import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  isAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const regularSpaceTokenAddress = '0x0692C428864A3e2775C4d4Db3a84124435C7913D';
const maxBatchSize = 100;

const baseChain = defineChain({
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://mainnet.base.org'],
    },
  },
});

const creditWhitelistAbi = [
  {
    type: 'function',
    name: 'batchSetCreditWhitelistAddresses',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'accounts', type: 'address[]', internalType: 'address[]' },
      { name: 'allowed', type: 'bool[]', internalType: 'bool[]' },
    ],
    outputs: [],
  },
] as const;

const addressSchema = z
  .string()
  .trim()
  .refine((value) => isAddress(value), {
    message: 'Invalid EVM address',
  })
  .transform((value) => value as `0x${string}`);

const requestSchema = z
  .object({
    accounts: z.array(addressSchema).min(1).max(maxBatchSize),
    allowed: z.array(z.boolean()).min(1).max(maxBatchSize),
  })
  .superRefine(({ accounts, allowed }, ctx) => {
    if (accounts.length !== allowed.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['allowed'],
        message: 'accounts and allowed must have the same length',
      });
    }
  });

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');

  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}

function secureEquals(a: string, b: string) {
  const aHash = createHash('sha256').update(a).digest();
  const bHash = createHash('sha256').update(b).digest();

  return timingSafeEqual(aHash, bHash);
}

function verifyApiKey(request: Request) {
  const expectedApiKey = process.env.MUTUAL_CREDIT_WHITELIST_API_KEY;

  if (!expectedApiKey) {
    console.error('Missing MUTUAL_CREDIT_WHITELIST_API_KEY');
    return false;
  }

  const providedApiKey =
    request.headers.get('x-api-key') ?? getBearerToken(request);

  return providedApiKey ? secureEquals(providedApiKey, expectedApiKey) : false;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getRpcUrl() {
  const rpcUrl = process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL;

  if (!rpcUrl) {
    throw new Error('Missing required environment variable: RPC_URL');
  }

  return rpcUrl;
}

function getSignerPrivateKey() {
  const value = getRequiredEnv(
    'MUTUAL_CREDIT_WHITELIST_SIGNER_PRIVATE_KEY',
  ).trim();

  return (value.startsWith('0x') ? value : `0x${value}`) as `0x${string}`;
}

export async function POST(request: Request) {
  if (!verifyApiKey(request)) {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const rpcUrl = getRpcUrl();
    const account = privateKeyToAccount(getSignerPrivateKey());
    const transport = http(rpcUrl);
    const publicClient = createPublicClient({
      chain: baseChain,
      transport,
    });
    const walletClient = createWalletClient({
      account,
      chain: baseChain,
      transport,
    });

    const { request: contractRequest } = await publicClient.simulateContract({
      account,
      address: regularSpaceTokenAddress,
      abi: creditWhitelistAbi,
      functionName: 'batchSetCreditWhitelistAddresses',
      args: [parsed.data.accounts, parsed.data.allowed],
    });
    const transactionHash = await walletClient.writeContract(contractRequest);

    return NextResponse.json({
      transactionHash,
      contractAddress: regularSpaceTokenAddress,
      accountCount: parsed.data.accounts.length,
    });
  } catch (error) {
    console.error('Failed to update mutual credit whitelist:', {
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Failed to update mutual credit whitelist' },
      { status: 500 },
    );
  }
}
