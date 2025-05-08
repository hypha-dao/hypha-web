import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Agreements contract ABI with necessary functions
const agreementsAbi = [
  {
    inputs: [{ internalType: 'uint256', name: '_spaceId', type: 'uint256' }],
    name: 'getSpaceProposals',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
      { internalType: 'uint256', name: '_proposalId', type: 'uint256' },
    ],
    name: 'hasProposal',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// DAOProposals ABI for checking execution status
const daoProposalsAbi = [
  {
    inputs: [{ internalType: 'uint256', name: '_proposalId', type: 'uint256' }],
    name: 'getProposalCore',
    outputs: [
      { internalType: 'uint256', name: 'spaceId', type: 'uint256' },
      { internalType: 'uint256', name: 'startTime', type: 'uint256' },
      { internalType: 'uint256', name: 'endTime', type: 'uint256' },
      { internalType: 'bool', name: 'executed', type: 'bool' },
      { internalType: 'bool', name: 'expired', type: 'bool' },
      { internalType: 'uint256', name: 'yesVotes', type: 'uint256' },
      { internalType: 'uint256', name: 'noVotes', type: 'uint256' },
      {
        internalType: 'uint256',
        name: 'totalVotingPowerAtSnapshot',
        type: 'uint256',
      },
      { internalType: 'address', name: 'creator', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

async function getSpaceAgreements(): Promise<void> {
  // Get command line arguments
  const args = process.argv.slice(2);
  let spaceId: number;
  let checkSpecificProposal = false;
  let proposalId: number = 0;
  let checkProposalStatus = false;

  // Parse arguments
  if (args.length === 0) {
    console.error('Please provide a space ID');
    console.log(
      'Usage: ts-node get-space-agreements.ts <spaceId> [proposalId] [--status]',
    );
    console.log('  <spaceId>: ID of the space to check for agreements');
    console.log(
      '  [proposalId]: (Optional) Check if a specific proposal has been accepted',
    );
    console.log(
      '  [--status]: (Optional) Check the execution status of proposals',
    );
    return;
  }

  spaceId = parseInt(args[0]);
  if (isNaN(spaceId)) {
    console.error('Invalid space ID. Please provide a valid number.');
    return;
  }

  // Check if a specific proposal ID was provided
  if (args.length > 1 && args[1] !== '--status') {
    proposalId = parseInt(args[1]);
    if (isNaN(proposalId)) {
      console.error('Invalid proposal ID. Please provide a valid number.');
      return;
    }
    checkSpecificProposal = true;
  }

  // Check if status flag is provided
  if (args.includes('--status')) {
    checkProposalStatus = true;
  }

  console.log(`Checking agreements for Space ID: ${spaceId}`);

  // Connect to network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  console.log(
    `Connected to network: ${await provider.getNetwork().then((n) => n.name)}`,
  );

  // Initialize wallet
  let wallet;
  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey) {
      const cleanPrivateKey = privateKey.startsWith('0x')
        ? privateKey.slice(2)
        : privateKey;
      wallet = new ethers.Wallet(cleanPrivateKey, provider);
      console.log(`Using wallet address: ${wallet.address}`);
    } else {
      console.log(
        'No private key found. Creating random wallet for read-only operations.',
      );
      wallet = ethers.Wallet.createRandom().connect(provider);
    }
  } catch (error) {
    console.error('Error setting up wallet:', error);
    return;
  }

  // Initialize contracts
  const agreementsAddresses = [
    process.env.AGREEMENTS_ADDRESS,
    '0x83B5d4F555A68126bB302685e67767Bb7a2985F0', // Fallback from create-agreement-proposal-test.ts
  ].filter(Boolean) as string[];

  if (agreementsAddresses.length === 0) {
    console.error(
      'No Agreements contract address provided. Please set AGREEMENTS_ADDRESS in .env file',
    );
    return;
  }

  // Try each Agreements contract address
  let agreements: ethers.Contract | null = null;
  let workingAddress: string | null = null;

  for (const address of agreementsAddresses) {
    console.log(`Trying Agreements contract at: ${address}`);
    const contract = new ethers.Contract(address, agreementsAbi, wallet);

    try {
      // Try a simple call to see if the contract is valid
      await contract.getSpaceProposals(1).catch(() => {});
      agreements = contract;
      workingAddress = address;
      console.log(
        `Successfully connected to Agreements contract at: ${address}`,
      );
      break;
    } catch (error) {
      console.log(
        `Could not validate contract at ${address}, trying next address...`,
      );
    }
  }

  if (!agreements || !workingAddress) {
    console.error(
      'Could not connect to any Agreements contract. Please check the address.',
    );
    return;
  }

  // Initialize DAO Proposals contract if needed
  let daoProposals: ethers.Contract | null = null;
  if (checkProposalStatus) {
    const daoProposalsAddresses = [
      process.env.DAO_PROPOSALS_ADDRESS,
      '0x001bA7a00a259Fb12d7936455e292a60FC2bef14', // From create-agreement-proposal-test.ts
      '0xaC840F8A96EC6A6f9FbfdAae8daF8d9D679fd48B', // Alternative address from the scripts
    ].filter(Boolean) as string[];

    for (const address of daoProposalsAddresses) {
      console.log(`Trying DAO Proposals contract at: ${address}`);
      const contract = new ethers.Contract(address, daoProposalsAbi, wallet);

      try {
        // Try a simple call
        await contract.getProposalCore(1).catch(() => {});
        daoProposals = contract;
        console.log(
          `Successfully connected to DAO Proposals contract at: ${address}`,
        );
        break;
      } catch (error) {
        console.log(
          `Could not validate contract at ${address}, trying next address...`,
        );
      }
    }

    if (!daoProposals) {
      console.warn(
        'Could not connect to DAO Proposals contract. Status checks will be disabled.',
      );
      checkProposalStatus = false;
    }
  }

  try {
    // If checking for a specific proposal
    if (checkSpecificProposal) {
      const hasProposal = await agreements.hasProposal(spaceId, proposalId);
      console.log(
        `\nSpace ${spaceId} ${
          hasProposal ? 'has' : 'has NOT'
        } accepted proposal ${proposalId}`,
      );

      // If proposal is accepted and we want to check status
      if (hasProposal && checkProposalStatus && daoProposals) {
        try {
          const proposalData = await daoProposals.getProposalCore(proposalId);
          console.log('\n----- Proposal Execution Status -----');
          console.log(`Executed: ${proposalData.executed}`);
          console.log(`Expired: ${proposalData.expired}`);
          console.log(`Yes votes: ${proposalData.yesVotes.toString()}`);
          console.log(`No votes: ${proposalData.noVotes.toString()}`);
          console.log(
            `Total voting power: ${proposalData.totalVotingPowerAtSnapshot.toString()}`,
          );

          // Calculate if the agreement proposal was automatically executed by vote
          const totalVotes = proposalData.yesVotes + proposalData.noVotes;
          const yesPercentage =
            totalVotes > 0n
              ? Number((proposalData.yesVotes * 100n) / totalVotes)
              : 0;

          console.log(`Yes vote percentage: ${yesPercentage}%`);

          if (proposalData.executed) {
            console.log('\nThe agreement proposal was successfully executed!');
            console.log('This means the acceptAgreement function was called.');
          } else if (proposalData.expired) {
            console.log('\nThe agreement proposal expired without execution.');
            console.log('The acceptAgreement function was NOT called.');
          } else {
            const now = Math.floor(Date.now() / 1000);
            if (now > Number(proposalData.endTime)) {
              console.log(
                '\nThe voting period has ended, but proposal was not executed.',
              );
              console.log('The acceptAgreement function was NOT called.');
            } else {
              console.log('\nThe voting period is still active.');
              console.log(
                'The acceptAgreement function has NOT been called yet.',
              );
            }
          }
        } catch (error) {
          console.error('Error fetching proposal data:', error);
        }
      }
      return;
    }

    // Get all accepted proposals for the space
    const acceptedProposals = await agreements.getSpaceProposals(spaceId);

    if (acceptedProposals.length === 0) {
      console.log(`\nSpace ${spaceId} has not accepted any proposals.`);
      return;
    }

    console.log(
      `\nSpace ${spaceId} has accepted ${acceptedProposals.length} proposal(s):`,
    );

    // Display all accepted proposals
    for (let i = 0; i < acceptedProposals.length; i++) {
      const proposalId = acceptedProposals[i];
      console.log(`${i + 1}. Proposal ID: ${proposalId.toString()}`);

      // Check execution status if requested
      if (checkProposalStatus && daoProposals) {
        try {
          const proposalData = await daoProposals.getProposalCore(proposalId);
          console.log(`   - Executed: ${proposalData.executed}`);
          console.log(`   - Expired: ${proposalData.expired}`);
          console.log(`   - Yes votes: ${proposalData.yesVotes.toString()}`);
          console.log(`   - No votes: ${proposalData.noVotes.toString()}`);
        } catch (error) {
          console.log(`   - Could not fetch proposal status`);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching agreements data:', error);
    console.log('Something went wrong. Check the error above for details.');
  }
}

// Run the script
getSpaceAgreements().catch(console.error);
