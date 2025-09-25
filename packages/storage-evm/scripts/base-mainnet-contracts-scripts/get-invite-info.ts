import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

interface InviteInfo {
  lastInviteTime: bigint;
  hasActiveProposal: boolean;
}

interface DAOSpaceFactoryInterface {
  getInviteInfo: (
    spaceId: number,
    memberAddress: string,
  ) => Promise<InviteInfo>;
}

const daoSpaceFactoryAbi = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_spaceId',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_memberAddress',
        type: 'address',
      },
    ],
    name: 'getInviteInfo',
    outputs: [
      {
        internalType: 'uint256',
        name: 'lastInviteTime',
        type: 'uint256',
      },
      {
        internalType: 'bool',
        name: 'hasActiveProposal',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

interface ParsedArgs {
  spaceId?: number;
  address?: string;
}

function parseArguments(): ParsedArgs {
  const args = process.argv.slice(2);
  const result: ParsedArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--spaceId' && i + 1 < args.length) {
      result.spaceId = parseInt(args[i + 1], 10);
      i++; // Skip the next argument as it's the value
    } else if (arg === '--address' && i + 1 < args.length) {
      result.address = args[i + 1];
      i++; // Skip the next argument as it's the value
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx tsx get-invite-info.ts --spaceId <ID> --address <ADDRESS>

Options:
  --spaceId <number>    The ID of the space
  --address <string>    The address of the user
  --help, -h            Show this help message

Example:
  npx tsx get-invite-info.ts --spaceId 338 --address 0xc4b6F66130A12172584F0061E9fEE98e6c6c4076
      `);
      process.exit(0);
    }
  }

  return result;
}

async function main(): Promise<void> {
  const { spaceId, address } = parseArguments();

  if (!spaceId || !address) {
    console.error('Error: --spaceId and --address are required arguments.');
    console.log('Run with --help for usage information.');
    process.exit(1);
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Get the contract instance
  const daoSpaceFactory = new ethers.Contract(
    process.env.DAO_SPACE_FACTORY_ADDRESS || '',
    daoSpaceFactoryAbi,
    provider,
  ) as ethers.Contract & DAOSpaceFactoryInterface;

  try {
    console.log(
      `Querying invite info for address ${address} in space ${spaceId}...\n`,
    );

    const inviteInfo = await daoSpaceFactory.getInviteInfo(spaceId, address);

    const lastInviteTimestamp = Number(inviteInfo.lastInviteTime);
    const lastInviteDate =
      lastInviteTimestamp > 0
        ? new Date(lastInviteTimestamp * 1000).toLocaleString()
        : 'N/A';

    console.log(`=== Invite Info for ${address} in Space ${spaceId} ===`);
    console.log(`Last Invite Time: ${lastInviteTimestamp} (${lastInviteDate})`);
    console.log(`Has Active Proposal: ${inviteInfo.hasActiveProposal}`);
    console.log('======================================================\n');
  } catch (error: any) {
    console.error(`Error fetching invite info: ${error.message}`);
    if (error.code === 'CALL_EXCEPTION') {
      console.error(
        'This might mean the space does not exist or there was a problem with the contract call.',
      );
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
