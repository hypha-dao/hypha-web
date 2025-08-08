import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Minimal ABI for DAOSpaceFactory removeMember + helpers
const daoSpaceFactoryAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
      { internalType: 'address', name: '_memberToRemove', type: 'address' },
    ],
    name: 'removeMember',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
      { internalType: 'address', name: '_userAddress', type: 'address' },
    ],
    name: 'isMember',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_spaceId', type: 'uint256' }],
    name: 'getSpaceMembers',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
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
];

function parseArgs(argv: string[]) {
  // Supports: --space <id> and one or more --member <address> (can repeat) or --members <a,b,c>
  const result: { spaceId?: number; members: string[] } = { members: [] };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--space' && i + 1 < argv.length) {
      result.spaceId = Number(argv[++i]);
    } else if (arg === '--member' && i + 1 < argv.length) {
      result.members.push(argv[++i]);
    } else if (arg === '--members' && i + 1 < argv.length) {
      const list = argv[++i]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      result.members.push(...list);
    }
  }
  return result;
}

function usage() {
  console.log('Usage:');
  console.log(
    '  npx ts-node scripts/base-mainnet-contracts-scripts/remove-member.ts --space <id> --member <addr> [--member <addr> ...]',
  );
  console.log('  or');
  console.log(
    '  npx ts-node scripts/base-mainnet-contracts-scripts/remove-member.ts --space <id> --members <addr1,addr2,...>',
  );
  console.log(
    '\nEnvironment variables: RPC_URL, PRIVATE_KEY, DAO_SPACE_FACTORY_ADDRESS',
  );
}

async function main() {
  const { spaceId, members } = parseArgs(process.argv);

  const rpcUrl = process.env.RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  const factoryAddress = process.env.DAO_SPACE_FACTORY_ADDRESS;

  if (!rpcUrl || !privateKey || !factoryAddress) {
    console.error(
      'Missing env. Ensure RPC_URL, PRIVATE_KEY, DAO_SPACE_FACTORY_ADDRESS are set.',
    );
    usage();
    process.exit(1);
  }

  if (!spaceId || !Number.isFinite(spaceId)) {
    console.error('Missing or invalid --space <id>');
    usage();
    process.exit(1);
  }

  if (!members || members.length === 0) {
    console.error(
      'Provide at least one --member <address> or --members <a,b,c>',
    );
    usage();
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Clean private key if it has 0x prefix
  const cleanPk = privateKey.startsWith('0x')
    ? privateKey.slice(2)
    : privateKey;
  const wallet = new ethers.Wallet(cleanPk, provider);

  console.log('Configured:');
  console.log(`- RPC_URL: ${rpcUrl}`);
  console.log(`- Wallet: ${wallet.address}`);
  console.log(`- Factory: ${factoryAddress}`);
  console.log(`- Space ID: ${spaceId}`);
  console.log(`- Members to remove: ${members.join(', ')}`);

  const daoSpaceFactory = new ethers.Contract(
    factoryAddress,
    daoSpaceFactoryAbi,
    wallet,
  );

  // Optional: show initial members
  try {
    const beforeMembers: string[] = await daoSpaceFactory.getSpaceMembers(
      spaceId,
    );
    console.log(
      `Current members (${beforeMembers.length}): ${beforeMembers.join(', ')}`,
    );
  } catch (e) {
    console.log(
      'Could not fetch current members (optional):',
      (e as Error).message,
    );
  }

  for (const m of members) {
    if (!ethers.isAddress(m)) {
      console.log(`Skipping invalid address: ${m}`);
      continue;
    }

    try {
      const wasMember: boolean = await daoSpaceFactory.isMember(spaceId, m);
      console.log(`\nRemoving ${m} (was member: ${wasMember}) ...`);
    } catch (_unused) {
      console.log(`\nRemoving ${m} ...`);
    }

    try {
      const tx = await daoSpaceFactory.removeMember(spaceId, m);
      console.log(`Submitted: ${tx.hash}`);
      const rcpt = await tx.wait();
      console.log(`Confirmed in block ${rcpt?.blockNumber}`);

      // Verify
      try {
        const isStillMember: boolean = await daoSpaceFactory.isMember(
          spaceId,
          m,
        );
        console.log(`isMember after removal: ${isStillMember}`);
      } catch (_unused) {
        // ignore if view fails
      }
    } catch (err) {
      console.error(`Failed to remove ${m}:`, err);
    }
  }

  // Optional: show final members
  try {
    const afterMembers: string[] = await daoSpaceFactory.getSpaceMembers(
      spaceId,
    );
    console.log(
      `\nFinal members (${afterMembers.length}): ${afterMembers.join(', ')}`,
    );
  } catch (e) {
    // ignore
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
