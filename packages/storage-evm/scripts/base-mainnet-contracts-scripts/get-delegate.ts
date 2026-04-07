import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

interface ParsedArgs {
  user?: string;
  spaceId?: number;
}

// Minimal ABI for the getDelegate function from IVotingPowerDelegation
const votingPowerDelegationAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_user',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_spaceId',
        type: 'uint256',
      },
    ],
    name: 'getDelegate',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

function parseArguments(): ParsedArgs {
  const args = process.argv.slice(2);
  const result: ParsedArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--user' && i + 1 < args.length) {
      result.user = args[i + 1];
      i++;
    } else if (arg === '--space' && i + 1 < args.length) {
      result.spaceId = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx tsx get-delegate.ts --user <user_address> --space <space_id>

Options:
  --user <address>    The address of the user to check delegation for.
  --space <number>    The ID of the space.
  --help, -h          Show this help message.

Example:
  npx tsx packages/storage-evm/scripts/base-mainnet-contracts-scripts/get-delegate.ts --user 0x... --space 1
      `);
      process.exit(0);
    }
  }

  if (!result.user || result.spaceId === undefined) {
    console.error('Error: Both --user and --space arguments are required.');
    console.log('Use --help for more information.');
    process.exit(1);
  }

  return result;
}

async function main() {
  const { user, spaceId } = parseArguments();

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  const contractAddress = '0xc87546357EeFF8653cF058Be2BA850813e39cda0';

  const votingPowerDelegation = new ethers.Contract(
    contractAddress,
    votingPowerDelegationAbi,
    provider,
  );

  try {
    console.log(`Querying delegate for user ${user} in space ${spaceId}...`);

    const delegate = await votingPowerDelegation.getDelegate(user, spaceId);

    console.log(`\nDelegate for ${user} in space ${spaceId} is:`);
    console.log(delegate);

    if (delegate.toLowerCase() === user!.toLowerCase()) {
      console.log('(User has not delegated their voting power in this space)');
    }
  } catch (error: any) {
    console.error(`Error querying contract: ${error.message}`);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
