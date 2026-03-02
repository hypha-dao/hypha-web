import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const hyphaTokenAbi = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'claimRewards',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'pendingRewards',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
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
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'unclaimedRewards',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

function usage(): void {
  console.log(
    'Usage: ts-node claim-rewards.ts [accountAddress] [hyphaTokenAddress] [--dry-run]',
  );
  console.log(
    'Example: ts-node claim-rewards.ts 0xEA9dE72f519aF9C66e7EBAAC0CE024a34Dd07427 --dry-run',
  );
  console.log('');
  console.log(
    'If no accountAddress is provided, defaults to 0xEA9dE72f519aF9C66e7EBAAC0CE024a34Dd07427',
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(0);
  }

  const dryRun = args.includes('--dry-run');
  const positionalArgs = args.filter((a) => !a.startsWith('-'));

  const accountAddress =
    positionalArgs[0] || '0xEA9dE72f519aF9C66e7EBAAC0CE024a34Dd07427';
  const hyphaTokenAddress =
    positionalArgs[1] || '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';

  if (!ethers.isAddress(accountAddress)) {
    throw new Error(`Invalid account address: ${accountAddress}`);
  }
  if (!ethers.isAddress(hyphaTokenAddress)) {
    throw new Error(`Invalid HyphaToken address: ${hyphaTokenAddress}`);
  }

  const rpcUrl = process.env.RPC_URL || 'https://base-rpc.publicnode.com';

  if (!process.env.RPC_URL) {
    console.log(
      `⚠️  RPC_URL not set in environment, using public Base mainnet RPC: ${rpcUrl}`,
    );
  } else {
    console.log(`Using RPC: ${rpcUrl}`);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  console.log(`HyphaToken Contract: ${hyphaTokenAddress}`);
  console.log(`Claiming rewards for: ${accountAddress}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (read-only)' : 'LIVE'}\n`);

  const [currentBalance, pending, unclaimed] = await Promise.all([
    new ethers.Contract(hyphaTokenAddress, hyphaTokenAbi, provider).balanceOf(
      accountAddress,
    ),
    new ethers.Contract(
      hyphaTokenAddress,
      hyphaTokenAbi,
      provider,
    ).pendingRewards(accountAddress),
    new ethers.Contract(
      hyphaTokenAddress,
      hyphaTokenAbi,
      provider,
    ).unclaimedRewards(accountAddress),
  ]);

  console.log('='.repeat(60));
  console.log('Current State');
  console.log('='.repeat(60));
  console.log(
    `HYPHA balance:      ${ethers.formatEther(currentBalance)} HYPHA`,
  );
  console.log(
    `Pending rewards:    ${ethers.formatEther(pending)} HYPHA`,
  );
  console.log(
    `Unclaimed rewards:  ${ethers.formatEther(unclaimed)} HYPHA`,
  );
  console.log('='.repeat(60));

  if (pending === 0n) {
    console.log('\nNo rewards to claim for this address.');
    return;
  }

  if (dryRun) {
    console.log(`\n[DRY RUN] Would claim ${ethers.formatEther(pending)} HYPHA`);
    console.log(
      `[DRY RUN] Expected balance after claim: ${ethers.formatEther(currentBalance + pending)} HYPHA`,
    );
    return;
  }

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      'PRIVATE_KEY environment variable is required for live transactions',
    );
  }

  const cleanPrivateKey = privateKey.startsWith('0x')
    ? privateKey
    : `0x${privateKey}`;

  const wallet = new ethers.Wallet(cleanPrivateKey, provider);
  console.log(`\nSending tx from wallet: ${wallet.address}`);

  const hyphaToken = new ethers.Contract(
    hyphaTokenAddress,
    hyphaTokenAbi,
    wallet,
  );

  console.log(
    `\nClaiming ${ethers.formatEther(pending)} HYPHA for ${accountAddress}...`,
  );

  const tx = await hyphaToken.claimRewards(accountAddress);
  console.log(`Transaction sent: ${tx.hash}`);
  console.log('Waiting for confirmation...');

  const receipt = await tx.wait();
  console.log(`\n✅ Rewards claimed successfully!`);
  console.log(`Block: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);

  const [newBalance, newPending] = await Promise.all([
    hyphaToken.balanceOf(accountAddress),
    hyphaToken.pendingRewards(accountAddress),
  ]);

  console.log('\n' + '='.repeat(60));
  console.log('After Claim');
  console.log('='.repeat(60));
  console.log(`HYPHA balance:      ${ethers.formatEther(newBalance)} HYPHA`);
  console.log(
    `Pending rewards:    ${ethers.formatEther(newPending)} HYPHA`,
  );
  console.log(
    `HYPHA received:     ${ethers.formatEther(newBalance - currentBalance)} HYPHA`,
  );
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('❌ Script failed:', err.message || err);
  process.exit(1);
});
