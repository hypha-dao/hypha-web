import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const regularSpaceTokenAbi = [
  {
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'burnFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'executor',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

function usage(): void {
  console.log(
    'Usage: npx ts-node burn-space-tokens.ts <tokenAddress> <fromAddress> <amount> [--dry-run]',
  );
  console.log('');
  console.log('Arguments:');
  console.log('  tokenAddress   The RegularSpaceToken contract address');
  console.log('  fromAddress    The address to burn tokens from');
  console.log(
    '  amount         The amount of tokens to burn (human-readable, e.g. 48768)',
  );
  console.log('  --dry-run      Simulate without sending a transaction');
  console.log('');
  console.log('Example:');
  console.log(
    '  npx ts-node burn-space-tokens.ts 0x95e0...2B1 0x3338...034 48768 --dry-run',
  );
  console.log('');
  console.log(
    'Note: The caller (PRIVATE_KEY) must be the executor of the token contract to burn without approval.',
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(0);
  }

  const positionalArgs = args.filter((a) => !a.startsWith('--'));
  const tokenAddress = positionalArgs[0];
  const fromAddress = positionalArgs[1];
  const amountStr = positionalArgs[2];
  const dryRun = args.includes('--dry-run');

  if (!tokenAddress || !fromAddress || !amountStr) {
    usage();
    process.exit(1);
  }

  if (!ethers.isAddress(tokenAddress)) {
    throw new Error(`Invalid token contract address: ${tokenAddress}`);
  }
  if (!ethers.isAddress(fromAddress)) {
    throw new Error(`Invalid from address: ${fromAddress}`);
  }

  if (!process.env.RPC_URL) {
    throw new Error('Missing required environment variable: RPC_URL');
  }
  if (!process.env.PRIVATE_KEY) {
    throw new Error('Missing required environment variable: PRIVATE_KEY');
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const token = new ethers.Contract(tokenAddress, regularSpaceTokenAbi, wallet);

  // Fetch token info
  const [
    decimalsRaw,
    totalSupply,
    contractOwner,
    contractExecutor,
    name,
    symbol,
  ] = await Promise.all([
    token.decimals(),
    token.totalSupply(),
    token.owner(),
    token.executor(),
    token.name(),
    token.symbol(),
  ]);
  const decimals =
    typeof decimalsRaw === 'bigint' ? Number(decimalsRaw) : decimalsRaw;

  let amountWei: bigint;
  try {
    amountWei = ethers.parseUnits(amountStr, decimals);
  } catch {
    throw new Error(
      `Invalid amount: ${amountStr}. Use a decimal string, e.g., 48768 or 100.5`,
    );
  }

  const targetBalance = await token.balanceOf(fromAddress);
  const callerIsExecutor =
    wallet.address.toLowerCase() === contractExecutor.toLowerCase();
  const callerIsOwner =
    wallet.address.toLowerCase() === contractOwner.toLowerCase();

  console.log(`\n=== Token Info ===`);
  console.log(`  Name:     ${name}`);
  console.log(`  Symbol:   ${symbol}`);
  console.log(`  Decimals: ${decimals}`);
  console.log(`  Contract: ${tokenAddress}`);
  console.log(`  Owner:    ${contractOwner}`);
  console.log(`  Executor: ${contractExecutor}`);
  console.log(
    `  Total Supply: ${ethers.formatUnits(totalSupply, decimals)} ${symbol}`,
  );

  console.log(`\n=== Burn Details ===`);
  console.log(`  From:   ${fromAddress}`);
  console.log(`  Amount: ${ethers.formatUnits(amountWei, decimals)} ${symbol}`);
  console.log(
    `  Balance before: ${ethers.formatUnits(
      targetBalance,
      decimals,
    )} ${symbol}`,
  );
  console.log(
    `  Balance after:  ${ethers.formatUnits(
      targetBalance - amountWei,
      decimals,
    )} ${symbol}`,
  );

  console.log(`\n=== Caller ===`);
  console.log(`  Address:     ${wallet.address}`);
  console.log(`  Is executor: ${callerIsExecutor}`);
  console.log(`  Is owner:    ${callerIsOwner}`);

  if (targetBalance < amountWei) {
    console.error(
      `\n❌ Error: Insufficient balance. Has ${ethers.formatUnits(
        targetBalance,
        decimals,
      )} ${symbol}, trying to burn ${ethers.formatUnits(
        amountWei,
        decimals,
      )} ${symbol}`,
    );
    process.exit(1);
  }

  if (!callerIsExecutor && !callerIsOwner) {
    console.warn(
      `\n⚠️  Warning: Caller is neither executor nor owner. burnFrom will require approval or revert.`,
    );
  }

  if (dryRun) {
    console.log(`\n=== Dry Run Simulation ===`);

    let staticOk = false;
    let staticError: string | undefined;
    try {
      await token.burnFrom.staticCall(fromAddress, amountWei);
      staticOk = true;
    } catch (e: any) {
      staticError = e?.shortMessage || e?.message || String(e);
    }

    let gasEstimate: bigint | undefined;
    try {
      gasEstimate = await token.burnFrom.estimateGas(fromAddress, amountWei);
    } catch {
      // ignore
    }

    console.log(`  Static simulation: ${staticOk ? '✅ OK' : '❌ FAILED'}`);
    if (staticError) {
      console.log(`  Error: ${staticError}`);
    }
    if (gasEstimate) {
      console.log(`  Estimated gas: ${gasEstimate.toString()}`);
    }

    console.log(`\n🔍 Dry run complete — no transaction sent.`);
    return;
  }

  // Execute the burn
  console.log(
    `\n🔥 Burning ${ethers.formatUnits(
      amountWei,
      decimals,
    )} ${symbol} from ${fromAddress}...`,
  );

  const tx = await token.burnFrom(fromAddress, amountWei);
  console.log(`  Tx sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  Tx confirmed in block ${receipt.blockNumber}`);

  // Show final state
  const [finalBalance, finalTotalSupply] = await Promise.all([
    token.balanceOf(fromAddress),
    token.totalSupply(),
  ]);
  console.log(`\n✅ Burn successful!`);
  console.log(
    `  Final balance of ${fromAddress}: ${ethers.formatUnits(
      finalBalance,
      decimals,
    )} ${symbol}`,
  );
  console.log(
    `  New total supply: ${ethers.formatUnits(
      finalTotalSupply,
      decimals,
    )} ${symbol}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
