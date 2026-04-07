import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

function parseAddressesFile(): Record<string, string> {
  const addressesPath = path.resolve(
    __dirname,
    '../../contracts/addresses.txt',
  );
  const fileContent = fs.readFileSync(addressesPath, 'utf8');

  const addresses: Record<string, string> = {};

  const patterns = {
    DAOSpaceFactory: /DAOSpaceFactory deployed to: (0x[a-fA-F0-9]{40})/,
  } as const;

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

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
    name: 'getSpaceExecutor',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

function usage(): void {
  console.log(
    'Usage: npx tsx add-member.ts <spaceId> <memberAddress> [factoryAddress] [--dry-run]',
  );
  console.log(
    'Example: npx tsx add-member.ts 241 0x0957113815E0a0b0584cc22C62f926217E7944d8 --dry-run',
  );
  console.log('');
  console.log(
    'Note: Only the contract owner or space executor can add members.',
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const spaceIdStr = args[0];
  const memberAddress = args[1];
  const factoryArg = args[2] && !args[2].startsWith('-') ? args[2] : undefined;
  const dryRun = args.includes('--dry-run');

  if (!spaceIdStr || !memberAddress) {
    usage();
    process.exit(1);
  }

  let spaceId: bigint;
  try {
    spaceId = BigInt(spaceIdStr);
  } catch {
    throw new Error(`Invalid space ID: ${spaceIdStr}. Must be a number.`);
  }

  if (!ethers.isAddress(memberAddress)) {
    throw new Error(`Invalid member address: ${memberAddress}`);
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  let factoryAddress = factoryArg;
  if (factoryAddress && !ethers.isAddress(factoryAddress)) {
    throw new Error(`Invalid DAOSpaceFactory address: ${factoryAddress}`);
  }
  if (!factoryAddress) {
    const addresses = parseAddressesFile();
    factoryAddress = addresses['DAOSpaceFactory'];
  }
  if (!factoryAddress) {
    throw new Error(
      'DAOSpaceFactory address not found. Provide it as the third arg or ensure contracts/addresses.txt contains it.',
    );
  }

  const factory = new ethers.Contract(
    factoryAddress,
    daoSpaceFactoryAbi,
    wallet,
  );

  // Get contract owner and space info
  const [contractOwner, spaceExecutor, currentMembers, isAlreadyMember] =
    await Promise.all([
      factory.owner(),
      factory.getSpaceExecutor(spaceId),
      factory.getSpaceMembers(spaceId),
      factory.isMember(spaceId, memberAddress),
    ]);

  if (dryRun) {
    const isOwner =
      wallet.address.toLowerCase() === contractOwner.toLowerCase();
    const isExecutor =
      wallet.address.toLowerCase() === spaceExecutor.toLowerCase();

    let staticOk = false;
    let staticError: string | undefined;
    try {
      // Static simulation
      await factory.addMember.staticCall(spaceId, memberAddress);
      staticOk = true;
    } catch (e: any) {
      staticError = e?.shortMessage || e?.message || String(e);
    }

    let gasEstimate: bigint | undefined;
    try {
      gasEstimate = await factory.addMember.estimateGas(spaceId, memberAddress);
    } catch {
      // ignore
    }

    const summary = {
      spaceId: spaceId.toString(),
      memberAddress,
      factoryAddress,
      caller: wallet.address,
      contractOwner,
      spaceExecutor,
      callerIsOwner: isOwner,
      callerIsExecutor: isExecutor,
      callerAuthorized: isOwner || isExecutor,
      currentMemberCount: currentMembers.length,
      isAlreadyMember,
      staticSimulationOk: staticOk,
      staticError: staticError || null,
      gasEstimate: gasEstimate ? gasEstimate.toString() : null,
      warning: isAlreadyMember
        ? 'Member is already in the space!'
        : !isOwner && !isExecutor
        ? 'Caller is not authorized (not owner or executor)!'
        : null,
    } as const;

    // Replace any stray BigInt values just in case
    const json = JSON.stringify(
      summary,
      (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
      2,
    );
    console.log(json);
    return; // do not send tx
  }

  // Warn if already a member
  if (isAlreadyMember) {
    throw new Error(
      `Address ${memberAddress} is already a member of space ${spaceId}`,
    );
  }

  // Check authorization
  const isOwner = wallet.address.toLowerCase() === contractOwner.toLowerCase();
  const isExecutor =
    wallet.address.toLowerCase() === spaceExecutor.toLowerCase();

  if (!isOwner && !isExecutor) {
    throw new Error(
      `Caller ${wallet.address} is not authorized. Contract owner: ${contractOwner}, Space executor: ${spaceExecutor}`,
    );
  }

  console.log(
    `Adding member ${memberAddress} to space ${spaceId} via ${factoryAddress}...`,
  );
  console.log(`Current member count: ${currentMembers.length}`);
  console.log(`Caller: ${wallet.address} (${isOwner ? 'owner' : 'executor'})`);

  const tx = await factory.addMember(spaceId, memberAddress);
  console.log('Tx sent:', tx.hash);
  await tx.wait();
  console.log('Member added successfully.');

  // Show final state
  const finalMembers = await factory.getSpaceMembers(spaceId);
  console.log(`New member count: ${finalMembers.length}`);
  console.log(
    `Member ${memberAddress} is now in space ${spaceId}: ${await factory.isMember(
      spaceId,
      memberAddress,
    )}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
