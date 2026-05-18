import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  isAddress,
} from 'viem';
import { nonceManager, privateKeyToAccount } from 'viem/accounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const regularSpaceTokenAddress = '0x0692C428864A3e2775C4d4Db3a84124435C7913D';
const maxBatchSize = 100;
const signerQueues = new Map<string, Promise<void>>();

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

    const seenAccounts = new Set<string>();
    accounts.forEach((account, index) => {
      const normalizedAccount = account.toLowerCase();
      if (seenAccounts.has(normalizedAccount)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['accounts', index],
          message: 'duplicate account in request',
        });
        return;
      }

      seenAccounts.add(normalizedAccount);
    });
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
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
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

async function withSignerQueue<T>(
  signerAddress: string,
  task: () => Promise<T>,
) {
  const previousTask = signerQueues.get(signerAddress) ?? Promise.resolve();
  let release!: () => void;
  const currentTask = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queuedTask = previousTask.then(() => currentTask);

  signerQueues.set(signerAddress, queuedTask);

  try {
    await previousTask;
    return await task();
  } finally {
    release();
    if (signerQueues.get(signerAddress) === queuedTask) {
      signerQueues.delete(signerAddress);
    }
  }
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
    const account = privateKeyToAccount(getSignerPrivateKey(), {
      nonceManager,
    });
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

    const transactionHash = await withSignerQueue(account.address, async () => {
      const { request: contractRequest } = await publicClient.simulateContract({
        account,
        address: regularSpaceTokenAddress,
        abi: creditWhitelistAbi,
        functionName: 'batchSetCreditWhitelistAddresses',
        args: [parsed.data.accounts, parsed.data.allowed],
      });

      return await walletClient.writeContract(contractRequest);
    });

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
