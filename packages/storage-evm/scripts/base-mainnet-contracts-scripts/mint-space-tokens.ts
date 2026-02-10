import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const spaceTokenAbi = [
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'mint',
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
    name: 'maxSupply',
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
    'Usage: ts-node mint-space-tokens.ts <tokenAddress> <toAddress> <amount> [--dry-run]',
  );
  console.log('');
  console.log('Arguments:');
  console.log('  tokenAddress   The token contract address');
  console.log('  toAddress      The address to mint tokens to');
  console.log(
    '  amount         The amount of tokens to mint (human-readable, e.g. 48768)',
  );
  console.log('  --dry-run      Simulate without sending a transaction');
  console.log('');
  console.log('Example:');
  console.log(
    '  ts-node mint-space-tokens.ts 0x5d33...1921 0x3338...034 48768 --dry-run',
  );
  console.log('');
  console.log(
    'Note: The caller (PRIVATE_KEY) must be the executor or owner of the token contract.',
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
  const toAddress = positionalArgs[1];
  const amountStr = positionalArgs[2];
  const dryRun = args.includes('--dry-run');

  if (!tokenAddress || !toAddress || !amountStr) {
    usage();
    process.exit(1);
  }

  if (!ethers.isAddress(tokenAddress)) {
    throw new Error(`Invalid token contract address: ${tokenAddress}`);
  }
  if (!ethers.isAddress(toAddress)) {
    throw new Error(`Invalid to address: ${toAddress}`);
  }

  if (!process.env.RPC_URL) {
    throw new Error('Missing required environment variable: RPC_URL');
  }
  if (!process.env.PRIVATE_KEY) {
    throw new Error('Missing required environment variable: PRIVATE_KEY');
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const token = new ethers.Contract(tokenAddress, spaceTokenAbi, wallet);

  // Fetch token info
  const [decimalsRaw, totalSupply, maxSupplyRaw, contractOwner, contractExecutor, name, symbol] =
    await Promise.all([
      token.decimals(),
      token.totalSupply(),
      token.maxSupply(),
      token.owner(),
      token.executor(),
      token.name(),
      token.symbol(),
    ]);
  const decimals =
    typeof decimalsRaw === 'bigint' ? Number(decimalsRaw) : decimalsRaw;
  const maxSupply = maxSupplyRaw as bigint;

  let amountWei: bigint;
  try {
    amountWei = ethers.parseUnits(amountStr, decimals);
  } catch {
    throw new Error(
      `Invalid amount: ${amountStr}. Use a decimal string, e.g., 48768 or 100.5`,
    );
  }

  const targetBalance = await token.balanceOf(toAddress);
  const callerIsExecutor =
    wallet.address.toLowerCase() === contractExecutor.toLowerCase();
  const callerIsOwner =
    wallet.address.toLowerCase() === contractOwner.toLowerCase();

  console.log(`\n=== Token Info ===`);
  console.log(`  Name:         ${name}`);
  console.log(`  Symbol:       ${symbol}`);
  console.log(`  Decimals:     ${decimals}`);
  console.log(`  Contract:     ${tokenAddress}`);
  console.log(`  Owner:        ${contractOwner}`);
  console.log(`  Executor:     ${contractExecutor}`);
  console.log(`  Total Supply: ${ethers.formatUnits(totalSupply, decimals)} ${symbol}`);
  console.log(
    `  Max Supply:   ${maxSupply === 0n ? 'Unlimited' : ethers.formatUnits(maxSupply, decimals) + ' ' + symbol}`,
  );

  console.log(`\n=== Mint Details ===`);
  console.log(`  To:     ${toAddress}`);
  console.log(`  Amount: ${ethers.formatUnits(amountWei, decimals)} ${symbol}`);
  console.log(`  Balance before: ${ethers.formatUnits(targetBalance, decimals)} ${symbol}`);
  console.log(
    `  Balance after:  ${ethers.formatUnits(targetBalance + amountWei, decimals)} ${symbol}`,
  );
  console.log(
    `  Total supply after: ${ethers.formatUnits(totalSupply + amountWei, decimals)} ${symbol}`,
  );

  if (maxSupply > 0n && totalSupply + amountWei > maxSupply) {
    console.error(
      `\n❌ Error: Mint would exceed max supply. Max: ${ethers.formatUnits(maxSupply, decimals)}, after mint: ${ethers.formatUnits(totalSupply + amountWei, decimals)}`,
    );
    process.exit(1);
  }

  console.log(`\n=== Caller ===`);
  console.log(`  Address:     ${wallet.address}`);
  console.log(`  Is executor: ${callerIsExecutor}`);
  console.log(`  Is owner:    ${callerIsOwner}`);

  if (!callerIsExecutor && !callerIsOwner) {
    console.warn(
      `\n⚠️  Warning: Caller is neither executor nor owner. Mint will likely revert.`,
    );
  }

  if (dryRun) {
    console.log(`\n=== Dry Run Simulation ===`);

    let staticOk = false;
    let staticError: string | undefined;
    try {
      await token.mint.staticCall(toAddress, amountWei);
      staticOk = true;
    } catch (e: any) {
      staticError = e?.shortMessage || e?.message || String(e);
    }

    let gasEstimate: bigint | undefined;
    try {
      gasEstimate = await token.mint.estimateGas(toAddress, amountWei);
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

  // Execute the mint
  console.log(
    `\n🪙 Minting ${ethers.formatUnits(amountWei, decimals)} ${symbol} to ${toAddress}...`,
  );

  const tx = await token.mint(toAddress, amountWei);
  console.log(`  Tx sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  Tx confirmed in block ${receipt.blockNumber}`);

  // Show final state
  const [finalBalance, finalTotalSupply] = await Promise.all([
    token.balanceOf(toAddress),
    token.totalSupply(),
  ]);
  console.log(`\n✅ Mint successful!`);
  console.log(
    `  Final balance of ${toAddress}: ${ethers.formatUnits(finalBalance, decimals)} ${symbol}`,
  );
  console.log(
    `  New total supply: ${ethers.formatUnits(finalTotalSupply, decimals)} ${symbol}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

