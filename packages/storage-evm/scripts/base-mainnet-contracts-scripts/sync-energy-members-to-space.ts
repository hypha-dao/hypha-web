/**
 * Add every on-chain energy-community member to the Hypha space that hosts it.
 *
 * Energy sharing (EnergyPPAv2 members) must also be DAO space members. This
 * script reads `getMemberAddresses` on the community proxy and calls
 * `DAOSpaceFactory.addMember` for any wallet that is not already in the space.
 *
 * Ponta do Sol (Base mainnet, deployed 2026-07-14):
 *   npx tsx sync-energy-members-to-space.ts --ponta --dry-run
 *   npx tsx sync-energy-members-to-space.ts --ponta
 *
 * Any other community:
 *   npx tsx sync-energy-members-to-space.ts --space-id 1132 --community 0x... --dry-run
 *
 * Requires RPC_URL. A write also requires PRIVATE_KEY for the factory owner
 * or the space executor. --dry-run only reads chain state.
 */
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

const PONTA_DO_SOL = {
  spaceId: 1132n,
  community: '0xf0c6659841f1D7080e68140cEbB28ba972cB469B',
} as const;

const daoSpaceFactoryAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
      { internalType: 'address', name: '_memberAddress', type: 'address' },
    ],
    name: 'addMember',
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
    inputs: [{ internalType: 'uint256', name: '_spaceId', type: 'uint256' }],
    name: 'getSpaceMembers',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_spaceId', type: 'uint256' }],
    name: 'getSpaceExecutor',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const energyCommunityAbi = [
  {
    inputs: [],
    name: 'getMemberAddresses',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

function parseFactoryAddress(): string | undefined {
  const addressesPath = path.resolve(
    __dirname,
    '../../contracts/addresses.txt',
  );
  const fileContent = fs.readFileSync(addressesPath, 'utf8');
  const match = fileContent.match(
    /DAOSpaceFactory deployed to: (0x[a-fA-F0-9]{40})/,
  );
  return match?.[1];
}

function usage(): void {
  console.log(
    'Usage: npx tsx sync-energy-members-to-space.ts (--ponta | --space-id <id> --community <proxy>) [--factory <address>] [--dry-run]',
  );
  console.log(
    'Example: npx tsx sync-energy-members-to-space.ts --ponta --dry-run',
  );
}

function readArg(flag: string, args: string[]): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const ponta = args.includes('--ponta');

  const spaceIdArg = readArg('--space-id', args);
  const communityArg = readArg('--community', args);
  const factoryArg = readArg('--factory', args);

  const spaceId = ponta
    ? PONTA_DO_SOL.spaceId
    : spaceIdArg
    ? BigInt(spaceIdArg)
    : undefined;
  const community = ponta ? PONTA_DO_SOL.community : communityArg;

  if (spaceId === undefined || !community) {
    usage();
    process.exit(1);
  }
  if (!ethers.isAddress(community)) {
    throw new Error(`Invalid community proxy: ${community}`);
  }

  const rpcUrl = process.env.RPC_URL || 'https://mainnet.base.org';
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  let factoryAddress = factoryArg;
  if (factoryAddress && !ethers.isAddress(factoryAddress)) {
    throw new Error(`Invalid DAOSpaceFactory address: ${factoryAddress}`);
  }
  if (!factoryAddress) {
    factoryAddress = parseFactoryAddress();
  }
  if (!factoryAddress) {
    throw new Error(
      'DAOSpaceFactory address not found. Pass --factory or set it in contracts/addresses.txt.',
    );
  }

  const factory = new ethers.Contract(
    factoryAddress,
    daoSpaceFactoryAbi,
    provider,
  );
  const communityContract = new ethers.Contract(
    community,
    energyCommunityAbi,
    provider,
  );

  const [spaceMembers, energyMembers, contractOwner, spaceExecutor] =
    await Promise.all([
      factory.getSpaceMembers(spaceId) as Promise<string[]>,
      communityContract.getMemberAddresses() as Promise<string[]>,
      factory.owner() as Promise<string>,
      factory.getSpaceExecutor(spaceId) as Promise<string>,
    ]);

  const spaceMemberSet = new Set(
    spaceMembers.map((address) => address.toLowerCase()),
  );
  const energyMemberSet = new Set(
    energyMembers.map((address) => address.toLowerCase()),
  );

  const missingFromSpace = energyMembers.filter(
    (address) => !spaceMemberSet.has(address.toLowerCase()),
  );
  const hiddenFromEnergySharing = spaceMembers.filter(
    (address) => !energyMemberSet.has(address.toLowerCase()),
  );

  console.log(
    JSON.stringify(
      {
        spaceId: spaceId.toString(),
        community,
        factoryAddress,
        contractOwner,
        spaceExecutor,
        energyMemberCount: energyMembers.length,
        spaceMemberCount: spaceMembers.length,
        missingFromSpace,
        hiddenFromEnergySharing,
        dryRun,
      },
      null,
      2,
    ),
  );

  if (missingFromSpace.length === 0) {
    console.log('Every energy-sharing member is already a space member.');
    return;
  }

  if (dryRun) {
    console.log(
      `Dry run: ${
        missingFromSpace.length
      } energy-sharing member(s) would be added to space ${spaceId.toString()}.`,
    );
    return;
  }

  if (!process.env.PRIVATE_KEY) {
    throw new Error(
      'PRIVATE_KEY is required to add members. Re-run with --dry-run to inspect only.',
    );
  }

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const factoryWriter = factory.connect(wallet) as ethers.Contract;
  const isOwner = wallet.address.toLowerCase() === contractOwner.toLowerCase();
  const isExecutor =
    wallet.address.toLowerCase() === spaceExecutor.toLowerCase();
  if (!isOwner && !isExecutor) {
    throw new Error(
      `Caller ${wallet.address} is not authorized. Contract owner: ${contractOwner}, Space executor: ${spaceExecutor}`,
    );
  }

  for (const memberAddress of missingFromSpace) {
    console.log(
      `Adding ${memberAddress} to space ${spaceId.toString()} as ${
        isOwner ? 'owner' : 'executor'
      }...`,
    );
    const tx = await factoryWriter.addMember(spaceId, memberAddress);
    console.log('Tx sent:', tx.hash);
    await tx.wait();
    console.log(`Added ${memberAddress}.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
