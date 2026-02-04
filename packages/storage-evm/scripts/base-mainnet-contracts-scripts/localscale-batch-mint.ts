import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

// LocalScale Ownership Token proxy address
const TOKEN_ADDRESS = '0x085a2bd60b5c786aDdf1cF87D72735ae4974D90b';

// Path to the addresses/amounts file
const DATA_FILE = path.resolve(__dirname, '../../contracts/localscale.txt');

const localScaleTokenAbi = [
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

interface MintEntry {
  address: string;
  amount: string;
  amountWei: bigint;
}

function parseDataFile(): MintEntry[] {
  const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
  const lines = fileContent.trim().split('\n');

  const entries: MintEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Split by tab or multiple spaces
    const parts = trimmed.split(/\t+|\s{2,}/);
    if (parts.length < 2) {
      console.warn(`Skipping invalid line: ${line}`);
      continue;
    }

    const address = parts[0].trim();
    // Remove commas from amount and parse
    const amountStr = parts[1].trim().replace(/,/g, '');

    if (!ethers.isAddress(address)) {
      console.warn(`Skipping invalid address: ${address}`);
      continue;
    }

    try {
      const amountWei = ethers.parseUnits(amountStr, 18);
      entries.push({
        address,
        amount: amountStr,
        amountWei,
      });
    } catch (e) {
      console.warn(`Skipping invalid amount for ${address}: ${amountStr}`);
    }
  }

  return entries;
}

function usage(): void {
  console.log('Usage: npx tsx localscale-batch-mint.ts [--dry-run]');
  console.log('');
  console.log('Options:');
  console.log(
    '  --dry-run    Simulate the minting without sending transactions',
  );
  console.log('');
  console.log(`Data file: ${DATA_FILE}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(0);
  }

  // Parse the data file
  const entries = parseDataFile();
  if (entries.length === 0) {
    console.error('No valid entries found in data file');
    process.exit(1);
  }

  console.log(`Found ${entries.length} addresses to mint tokens to`);
  console.log('');

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  console.log('Connected with wallet:', wallet.address);
  console.log('Token address:', TOKEN_ADDRESS);
  console.log('');

  // Get the contract instance
  const token = new ethers.Contract(TOKEN_ADDRESS, localScaleTokenAbi, wallet);

  // Get token info
  const [name, symbol, decimals, totalSupply, maxSupply, owner, executor] =
    await Promise.all([
      token.name(),
      token.symbol(),
      token.decimals(),
      token.totalSupply(),
      token.maxSupply(),
      token.owner(),
      token.executor(),
    ]);

  console.log('=== Token Info ===');
  console.log(`Name: ${name}`);
  console.log(`Symbol: ${symbol}`);
  console.log(`Decimals: ${decimals}`);
  console.log(`Total Supply: ${ethers.formatUnits(totalSupply, decimals)}`);
  console.log(
    `Max Supply: ${
      maxSupply === 0n ? 'Unlimited' : ethers.formatUnits(maxSupply, decimals)
    }`,
  );
  console.log(`Owner: ${owner}`);
  console.log(`Executor: ${executor}`);
  console.log('');

  // Check if wallet is owner or executor
  const isOwner = wallet.address.toLowerCase() === owner.toLowerCase();
  const isExecutor = wallet.address.toLowerCase() === executor.toLowerCase();
  console.log(`Wallet is owner: ${isOwner}`);
  console.log(`Wallet is executor: ${isExecutor}`);

  if (!isOwner && !isExecutor) {
    console.error(
      '❌ Error: Wallet is neither owner nor executor. Cannot mint tokens.',
    );
    process.exit(1);
  }
  console.log('');

  // Calculate total amount to mint
  const totalToMint = entries.reduce((acc, entry) => acc + entry.amountWei, 0n);
  console.log(
    `Total amount to mint: ${ethers.formatUnits(
      totalToMint,
      Number(decimals),
    )} ${symbol}`,
  );
  console.log('');

  // Check if minting would exceed max supply
  if (maxSupply > 0n && totalSupply + totalToMint > maxSupply) {
    console.error(
      `❌ Error: Minting would exceed max supply. Max: ${ethers.formatUnits(
        maxSupply,
        Number(decimals),
      )}, Current: ${ethers.formatUnits(
        totalSupply,
        Number(decimals),
      )}, To mint: ${ethers.formatUnits(totalToMint, Number(decimals))}`,
    );
    process.exit(1);
  }

  // Display mint plan
  console.log('=== Mint Plan ===');
  for (const entry of entries) {
    console.log(`  ${entry.address}: ${entry.amount} ${symbol}`);
  }
  console.log('');

  if (dryRun) {
    console.log('=== DRY RUN MODE - Simulating transactions ===');
    console.log('');

    let successCount = 0;
    let failCount = 0;

    for (const entry of entries) {
      try {
        // Static simulation
        await token.mint.staticCall(entry.address, entry.amountWei);

        // Estimate gas
        const gasEstimate = await token.mint.estimateGas(
          entry.address,
          entry.amountWei,
        );

        console.log(
          `✅ ${entry.address}: ${entry.amount} - would succeed (gas: ${gasEstimate})`,
        );
        successCount++;
      } catch (e: any) {
        const errorMsg = e?.shortMessage || e?.message || String(e);
        console.log(
          `❌ ${entry.address}: ${entry.amount} - would FAIL: ${errorMsg}`,
        );
        failCount++;
      }
    }

    console.log('');
    console.log('=== Dry Run Summary ===');
    console.log(`Would succeed: ${successCount}`);
    console.log(`Would fail: ${failCount}`);
    console.log('');
    console.log('Run without --dry-run to execute the minting.');
    return;
  }

  // Execute minting
  console.log('=== Executing Minting ===');
  console.log('');

  const results: {
    address: string;
    amount: string;
    txHash?: string;
    error?: string;
  }[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    console.log(
      `[${i + 1}/${entries.length}] Minting ${entry.amount} to ${
        entry.address
      }...`,
    );

    try {
      const tx = await token.mint(entry.address, entry.amountWei);
      console.log(`  Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log(`  ✅ Confirmed!`);
      results.push({
        address: entry.address,
        amount: entry.amount,
        txHash: tx.hash,
      });
    } catch (e: any) {
      const errorMsg = e?.shortMessage || e?.message || String(e);
      console.log(`  ❌ FAILED: ${errorMsg}`);
      results.push({
        address: entry.address,
        amount: entry.amount,
        error: errorMsg,
      });
    }

    // Small delay between transactions to avoid nonce issues
    if (i < entries.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log('');
  console.log('=== Minting Complete ===');

  const successResults = results.filter((r) => r.txHash);
  const failResults = results.filter((r) => r.error);

  console.log(`Successful: ${successResults.length}`);
  console.log(`Failed: ${failResults.length}`);

  if (failResults.length > 0) {
    console.log('');
    console.log('Failed addresses:');
    for (const result of failResults) {
      console.log(`  ${result.address}: ${result.error}`);
    }
  }

  // Verify final balances
  console.log('');
  console.log('=== Verifying Balances ===');
  for (const entry of entries) {
    const balance = await token.balanceOf(entry.address);
    console.log(
      `  ${entry.address}: ${ethers.formatUnits(
        balance,
        Number(decimals),
      )} ${symbol}`,
    );
  }

  // Save results to file
  const resultsFile = path.resolve(
    __dirname,
    `localscale-mint-results-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.json`,
  );
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log('');
  console.log(`Results saved to: ${resultsFile}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
