import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Minimal ABI for DecayingSpaceToken applyDecay + balanceOf
const decayingSpaceTokenAbi = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'applyDecay',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

function parseArgs(argv: string[]) {
  const result: { tokenAddress?: string; users: string[] } = { users: [] };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--token' && i + 1 < argv.length) {
      result.tokenAddress = argv[++i];
    } else if (arg === '--user' && i + 1 < argv.length) {
      result.users.push(argv[++i]);
    } else if (arg === '--users' && i + 1 < argv.length) {
      const list = argv[++i]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      result.users.push(...list);
    }
  }
  return result;
}

function usage() {
  console.log('Usage:');
  console.log(
    '  npx ts-node scripts/base-mainnet-contracts-scripts/apply-decay.ts --token <addr> --user <addr> [--user <addr> ...]',
  );
  console.log('  or');
  console.log(
    '  npx ts-node scripts/base-mainnet-contracts-scripts/apply-decay.ts --token <addr> --users <addr1,addr2,...>',
  );
  console.log('\nEnvironment variables: RPC_URL, PRIVATE_KEY');
}

async function main() {
  const { tokenAddress, users } = parseArgs(process.argv);

  const rpcUrl = process.env.RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    console.error('Missing env. Ensure RPC_URL, PRIVATE_KEY are set.');
    usage();
    process.exit(1);
  }

  if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
    console.error('Missing or invalid --token <address>');
    usage();
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.error('Provide at least one --user <address> or --users <a,b,c>');
    usage();
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const cleanPk = privateKey.startsWith('0x')
    ? privateKey.slice(2)
    : privateKey;
  const wallet = new ethers.Wallet(cleanPk, provider);

  console.log('Configured:');
  console.log(`- RPC_URL: ${rpcUrl}`);
  console.log(`- Wallet: ${wallet.address}`);
  console.log(`- Token: ${tokenAddress}`);
  console.log(`- Users to apply decay: ${users.join(', ')}`);

  const decayingSpaceToken = new ethers.Contract(
    tokenAddress,
    decayingSpaceTokenAbi,
    wallet,
  );

  for (const user of users) {
    if (!ethers.isAddress(user)) {
      console.log(`\nSkipping invalid address: ${user}`);
      continue;
    }

    console.log(`\nProcessing user: ${user}`);

    try {
      const balanceBefore = await decayingSpaceToken.balanceOf(user);
      console.log(
        `Balance before decay: ${ethers.formatUnits(balanceBefore, 18)}`,
      );
    } catch (e) {
      console.log(
        'Could not fetch current balance (optional):',
        (e as Error).message,
      );
    }

    try {
      console.log(`Applying decay for ${user} ...`);
      const tx = await decayingSpaceToken.applyDecay(user);
      console.log(`Submitted: ${tx.hash}`);
      const rcpt = await tx.wait();
      console.log(`Confirmed in block ${rcpt?.blockNumber}`);

      // Verify
      try {
        const balanceAfter = await decayingSpaceToken.balanceOf(user);
        console.log(
          `Balance after decay: ${ethers.formatUnits(balanceAfter, 18)}`,
        );
      } catch (_unused) {
        // ignore if view fails
      }
    } catch (err) {
      console.error(`Failed to apply decay for ${user}:`, err);
    }
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
