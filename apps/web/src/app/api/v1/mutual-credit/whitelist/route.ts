import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  isAddress,
  isAddressEqual,
  zeroAddress,
} from 'viem';
import { nonceManager, privateKeyToAccount } from 'viem/accounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
  },
  {
    type: 'function',
    name: 'executor',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
  },
  {
    type: 'function',
    name: 'isAuthorizedMinter',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
  },
] as const;

const addressSchema = z
  .string()
  .trim()
  .refine((value) => isAddress(value), {
    message: 'Invalid EVM address',
  })
  .transform((value) => getAddress(value));

const tokenAddressSchema = addressSchema.refine(
  (value) => !isAddressEqual(value, zeroAddress),
  { message: 'tokenAddress must not be the zero address' },
);

const requestSchema = z
  .object({
    tokenAddress: tokenAddressSchema,
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

async function assertSignerCanManageCreditWhitelist(
  publicClient: ReturnType<typeof createPublicClient>,
  tokenAddress: `0x${string}`,
  signerAddress: `0x${string}`,
) {
  const bytecode = await publicClient.getBytecode({ address: tokenAddress });
  if (!bytecode || bytecode === '0x') {
    throw new Error('tokenAddress is not a contract');
  }

  const [owner, executor] = await Promise.all([
    publicClient.readContract({
      address: tokenAddress,
      abi: creditWhitelistAbi,
      functionName: 'owner',
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: creditWhitelistAbi,
      functionName: 'executor',
    }),
  ]);

  let isAuthorizedMinter = false;
  try {
    isAuthorizedMinter = await publicClient.readContract({
      address: tokenAddress,
      abi: creditWhitelistAbi,
      functionName: 'isAuthorizedMinter',
      args: [signerAddress],
    });
  } catch {
    // Older token implementations may not expose authorized minters.
  }

  const canManage =
    isAddressEqual(owner, signerAddress) ||
    isAddressEqual(executor, signerAddress) ||
    isAuthorizedMinter;

  if (!canManage) {
    throw new Error(
      'Signer is not owner, executor, or authorized minter on tokenAddress',
    );
  }
}

function isClientError(message: string) {
  return (
    message.includes('tokenAddress is not a contract') ||
    message.includes('Signer is not owner, executor, or authorized minter')
  );
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

  const { tokenAddress, accounts, allowed } = parsed.data;

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

    await assertSignerCanManageCreditWhitelist(
      publicClient,
      tokenAddress,
      account.address,
    );

    const transactionHash = await withSignerQueue(account.address, async () => {
      const { request: contractRequest } = await publicClient.simulateContract({
        account,
        address: tokenAddress,
        abi: creditWhitelistAbi,
        functionName: 'batchSetCreditWhitelistAddresses',
        args: [accounts, allowed],
      });

      return await walletClient.writeContract(contractRequest);
    });

    return NextResponse.json({
      transactionHash,
      contractAddress: tokenAddress,
      accountCount: accounts.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to update mutual credit whitelist:', {
      message,
      tokenAddress,
    });

    if (isClientError(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to update mutual credit whitelist' },
      { status: 500 },
    );
  }
}
