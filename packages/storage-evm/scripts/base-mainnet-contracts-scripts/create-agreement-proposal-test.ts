import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface SpaceCreationParams {
  unity: number;
  quorum: number;
  votingPowerSource: number;
  exitMethod: number;
  joinMethod: number;
}

interface Transaction {
  target: string | ethers.Addressable;
  value: number;
  data: string | Uint8Array;
}

interface ProposalParams {
  spaceId: number;
  duration: number;
  transactions: Transaction[];
}

interface AccountData {
  privateKey: string;
  address: string;
}

// DAOSpaceFactory ABI with necessary functions
const daoSpaceFactoryAbi = [
  {
    inputs: [
      {
        components: [
          { internalType: 'uint256', name: 'unity', type: 'uint256' },
          { internalType: 'uint256', name: 'quorum', type: 'uint256' },
          {
            internalType: 'uint256',
            name: 'votingPowerSource',
            type: 'uint256',
          },
          { internalType: 'uint256', name: 'exitMethod', type: 'uint256' },
          { internalType: 'uint256', name: 'joinMethod', type: 'uint256' },
        ],
        internalType:
          'struct DAOSpaceFactoryImplementation.SpaceCreationParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'createSpace',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_spaceId', type: 'uint256' }],
    name: 'getSpaceExecutor',
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
];

// DAOProposals ABI with necessary functions
const daoProposalsAbi = [
  {
    inputs: [
      {
        components: [
          { internalType: 'uint256', name: 'spaceId', type: 'uint256' },
          { internalType: 'uint256', name: 'duration', type: 'uint256' },
          {
            components: [
              { internalType: 'address', name: 'target', type: 'address' },
              { internalType: 'uint256', name: 'value', type: 'uint256' },
              { internalType: 'bytes', name: 'data', type: 'bytes' },
            ],
            internalType: 'struct IDAOProposals.Transaction[]',
            name: 'transactions',
            type: 'tuple[]',
          },
        ],
        internalType: 'struct IDAOProposals.ProposalParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'createProposal',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_proposalId', type: 'uint256' },
      { internalType: 'bool', name: '_support', type: 'bool' },
    ],
    name: 'vote',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
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
  {
    inputs: [{ internalType: 'uint256', name: '_proposalId', type: 'uint256' }],
    name: 'execute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

// Agreements ABI with necessary functions
const agreementsAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
      { internalType: 'uint256', name: '_proposalId', type: 'uint256' },
    ],
    name: 'acceptAgreement',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
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
  {
    inputs: [],
    name: 'spaceFactory',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// Function to wait for a specified delay
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testAgreementProposal(): Promise<void> {
  console.log('Starting Agreement Proposal Test...');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Load account data
  let accountData: AccountData[] = [];
  try {
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) {
      accountData = JSON.parse(data);
    }
  } catch (error) {
    console.log(
      'accounts.json not found or invalid. Using environment variables.',
    );
  }

  // If no accounts from JSON, try to use environment variable
  if (accountData.length === 0) {
    const privateKey = process.env.PRIVATE_KEY;

    if (privateKey) {
      console.log('Using private key from environment variable.');
      try {
        // Remove 0x prefix if present
        const cleanPrivateKey = privateKey.startsWith('0x')
          ? privateKey.slice(2)
          : privateKey;

        const wallet = new ethers.Wallet(cleanPrivateKey);
        accountData = [
          {
            privateKey: cleanPrivateKey,
            address: wallet.address,
          },
        ];
      } catch (error) {
        console.error(
          'Invalid private key format in environment variable:',
          error,
        );
      }
    } else {
      console.error('PRIVATE_KEY not found in environment variables.');
    }
  }

  if (accountData.length === 0) {
    console.error(
      'No accounts found. Please create an accounts.json file or provide a valid PRIVATE_KEY in .env',
    );
    return;
  }

  const wallet = new ethers.Wallet(accountData[0].privateKey, provider);
  console.log(`Using wallet address: ${wallet.address}`);

  // Initialize contracts
  const daoSpaceFactory = new ethers.Contract(
    process.env.DAO_SPACE_FACTORY_ADDRESS ||
      '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9',
    daoSpaceFactoryAbi,
    wallet,
  );

  // Use the correct DAO Proposals address from .env
  const daoProposalsAddress =
    process.env.DAO_PROPOSALS_ADDRESS ||
    '0x001bA7a00a259Fb12d7936455e292a60FC2bef14';
  const daoProposals = new ethers.Contract(
    daoProposalsAddress,
    daoProposalsAbi,
    wallet,
  );

  // Initialize Agreements contract
  const agreementsAddress =
    process.env.AGREEMENTS_ADDRESS ||
    '0x83B5d4F555A68126bB302685e67767Bb7a2985F0';
  const agreements = new ethers.Contract(
    agreementsAddress,
    agreementsAbi,
    wallet,
  );

  // After loading the contracts, add this debugging info:
  console.log('Contract addresses:');
  console.log(`- DAO Space Factory: ${daoSpaceFactory.target}`);
  console.log(`- DAO Proposals: ${daoProposals.target}`);
  console.log(`- Agreements: ${agreements.target}`);

  // Check if space factory is set in agreements contract
  try {
    const configuredSpaceFactory = await agreements.spaceFactory();
    console.log(
      `Space factory configured in Agreements: ${configuredSpaceFactory}`,
    );

    if (configuredSpaceFactory === ethers.ZeroAddress) {
      console.error('Space factory not set in Agreements contract!');
      console.log(
        'Please set the space factory in Agreements contract before proceeding.',
      );
      return;
    }

    if (
      String(configuredSpaceFactory).toLowerCase() !==
      String(daoSpaceFactory.target).toLowerCase()
    ) {
      console.warn(
        'WARNING: Space factory in Agreements contract differs from the one we are using!',
      );
      console.log(`Agreements is using: ${configuredSpaceFactory}`);
      console.log(`Our script is using: ${daoSpaceFactory.target}`);
    }
  } catch (error) {
    console.log('Failed to check space factory in Agreements contract:', error);
    console.log('Continuing with the test anyway...');
  }

  // Step 1: Create a Space
  console.log('\nCreating a new space...');
  const spaceParams: SpaceCreationParams = {
    unity: 51, // 51% unity - single address can pass
    quorum: 51, // 51% quorum - single address can pass
    votingPowerSource: 2, // Space voting power (1 member = 1 vote)
    exitMethod: 2, // Not critical for this test
    joinMethod: 1, // Not critical for this test
  };

  try {
    console.log(
      `Creating space with unity: ${spaceParams.unity}, quorum: ${spaceParams.quorum}`,
    );
    const tx = await daoSpaceFactory.createSpace(spaceParams);
    console.log(`Space creation transaction submitted: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log('Space creation transaction confirmed');

    // Find the SpaceCreated event
    const event = receipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'SpaceCreated(uint256,uint256,uint256,uint256,uint256,uint256,address,address)',
        ),
    );

    if (!event) {
      console.error('Space creation event not found in transaction receipt');
      return;
    }

    const spaceId = parseInt(event.topics[1], 16);
    console.log(`Space created with ID: ${spaceId}`);

    // Get space executor
    const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);
    console.log(`Space executor address: ${executorAddress}`);

    // Verify membership
    const members = await daoSpaceFactory.getSpaceMembers(spaceId);
    console.log(`Space members: ${members}`);
    console.log(`Creator is member: ${members.includes(wallet.address)}`);

    // Step 2: Define a proposal ID to accept
    const proposalIdToAccept = 12345; // Arbitrary ID
    console.log(
      `\nUsing arbitrary proposal ID for agreement: ${proposalIdToAccept}`,
    );

    // Check if this proposal is already accepted in this space
    const alreadyAccepted = await agreements.hasProposal(
      spaceId,
      proposalIdToAccept,
    );
    if (alreadyAccepted) {
      console.warn(
        `WARNING: Proposal ID ${proposalIdToAccept} is already accepted for space ${spaceId}`,
      );
      console.log('Continuing anyway...');
    }

    // Step 3: Create a proposal to call acceptAgreement
    console.log('\nCreating a proposal to call acceptAgreement...');

    // Encode the acceptAgreement function call
    const acceptAgreementData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'uint256'],
      [spaceId, proposalIdToAccept],
    );

    const acceptAgreementMethod = 'acceptAgreement(uint256,uint256)';
    const functionSelector = ethers.id(acceptAgreementMethod).substring(0, 10);
    const encodedData = functionSelector + acceptAgreementData.substring(2); // remove 0x prefix

    // Create proposal to call acceptAgreement
    const agreementProposalParams: ProposalParams = {
      spaceId: spaceId,
      duration: 3600, // 1 hour in seconds
      transactions: [
        {
          target: String(agreementsAddress),
          value: 0, // No ETH transfer
          data: encodedData,
        },
      ],
    };

    console.log('\n=== DETAILED PROPOSAL INPUT DATA ===');
    console.log(`Space ID: ${agreementProposalParams.spaceId}`);
    console.log(
      `Proposal Duration: ${agreementProposalParams.duration} seconds`,
    );
    console.log(
      `Transaction Count: ${agreementProposalParams.transactions.length}`,
    );

    // Log detailed transaction data
    agreementProposalParams.transactions.forEach((tx, index) => {
      console.log(`\nTransaction #${index + 1}:`);
      console.log(`- Target Contract: ${tx.target}`);
      console.log(`- ETH Value: ${tx.value}`);
      console.log(`- Function: acceptAgreement(uint256,uint256)`);
      console.log(`- Function Parameters:`);
      console.log(`  - Space ID: ${spaceId}`);
      console.log(`  - Proposal ID to accept: ${proposalIdToAccept}`);
      console.log(`- Function Selector: ${functionSelector}`);
      console.log(`- Complete Encoded Data: ${encodedData}`);
      console.log(
        `- Data Length: ${
          typeof tx.data === 'string' ? tx.data.length : '(binary)'
        } bytes`,
      );
    });
    console.log('\n=====================================');

    console.log('Agreement Proposal parameters:', {
      spaceId: agreementProposalParams.spaceId,
      duration: agreementProposalParams.duration,
      transactions: agreementProposalParams.transactions.map((t) => ({
        target: t.target,
        value: t.value,
        dataLength: typeof t.data === 'string' ? t.data.length : '(binary)',
      })),
    });

    console.log('Submitting agreement proposal creation transaction...');
    try {
      const createAgreementProposalTx = await daoProposals.createProposal(
        agreementProposalParams,
        {
          gasLimit: 5000000,
        },
      );

      console.log(
        `Agreement proposal creation tx hash: ${createAgreementProposalTx.hash}`,
      );

      const createAgreementProposalReceipt =
        await createAgreementProposalTx.wait();
      console.log('Agreement proposal creation confirmed');

      // Find the ProposalCreated event
      const agreementProposalEvent = createAgreementProposalReceipt?.logs.find(
        (log) =>
          log.topics[0] ===
          ethers.id(
            'ProposalCreated(uint256,uint256,uint256,uint256,address,bytes)',
          ),
      );

      if (!agreementProposalEvent) {
        console.error('Agreement proposal creation event not found');
        return;
      }

      const agreementProposalId = parseInt(
        agreementProposalEvent.topics[1],
        16,
      );
      console.log(`Agreement proposal created with ID: ${agreementProposalId}`);

      // Step 4: Vote on the agreement proposal
      console.log('\nVoting on the agreement proposal...');
      const agreementVoteTx = await daoProposals.vote(
        agreementProposalId,
        true, // Vote YES
      );
      console.log(`Agreement vote transaction hash: ${agreementVoteTx.hash}`);

      await agreementVoteTx.wait();
      console.log('Agreement vote confirmed');

      // Step 5: Immediately check if the vote triggered automatic execution
      console.log(
        '\nChecking if proposal was automatically executed by voting...',
      );

      // Check the proposal status
      const proposalData = await daoProposals.getProposalCore(
        agreementProposalId,
      );

      console.log('Proposal status:');
      console.log(`- Executed: ${proposalData.executed}`);
      console.log(`- Expired: ${proposalData.expired}`);
      console.log(`- Yes votes: ${proposalData.yesVotes.toString()}`);
      console.log(`- No votes: ${proposalData.noVotes.toString()}`);
      console.log(
        `- Total voting power: ${proposalData.totalVotingPowerAtSnapshot.toString()}`,
      );

      const totalVotes = proposalData.yesVotes + proposalData.noVotes;
      const yesPercentage =
        totalVotes > 0n
          ? Number((proposalData.yesVotes * 100n) / totalVotes)
          : 0;

      console.log(`\nVoting statistics:`);
      console.log(`- Yes vote percentage: ${yesPercentage}%`);

      // Wait a moment before checking the agreement status
      console.log('\nWaiting briefly before checking agreement status...');
      await delay(2000); // Wait 2 seconds

      // Check if the agreement was accepted
      const hasProposal = await agreements.hasProposal(
        spaceId,
        proposalIdToAccept,
      );

      console.log(`\nAgreement status:`);
      console.log(`Agreement accepted in space ${spaceId}: ${hasProposal}`);

      // Get all proposals for the space
      const spaceProposals = await agreements.getSpaceProposals(spaceId);
      console.log(`Space proposals: ${spaceProposals.join(', ')}`);

      if (proposalData.executed) {
        console.log(
          '\n✅ SUCCESS: The proposal was automatically executed by voting!',
        );

        if (hasProposal) {
          console.log('The acceptAgreement function was successfully called.');
        } else {
          console.log(
            '⚠️ WARNING: Proposal shows as executed, but agreement was not accepted.',
          );
          console.log(
            'This suggests a problem with the acceptAgreement function or parameters.',
          );
        }
      } else {
        console.log(
          '\n❌ The proposal was NOT automatically executed by voting.',
        );

        if (proposalData.expired) {
          console.log('The proposal has expired without being executed.');
        } else if (yesPercentage <= 50) {
          console.log(
            'Not enough YES votes to execute the proposal automatically.',
          );
        } else {
          console.log(
            'The proposal should have been executed. There might be an issue with the contract.',
          );

          // Try manually executing the proposal
          console.log('\nAttempting to manually execute the proposal...');
          try {
            const executeTx = await daoProposals.execute(agreementProposalId);
            console.log(`Execute transaction hash: ${executeTx.hash}`);

            await executeTx.wait();
            console.log('Execute transaction confirmed');

            // Check again if the agreement was accepted after manual execution
            const hasProposalAfterExecution = await agreements.hasProposal(
              spaceId,
              proposalIdToAccept,
            );

            if (hasProposalAfterExecution) {
              console.log(
                '\n✅ SUCCESS: The agreement was accepted after manual execution.',
              );
            } else {
              console.log(
                '\n❌ The agreement was NOT accepted even after manual execution.',
              );
            }
          } catch (executeError) {
            console.error(
              'Failed to manually execute the proposal:',
              executeError,
            );
          }
        }
      }

      // Final status report
      console.log('\n==== FINAL STATUS ====');
      const finalProposalData = await daoProposals.getProposalCore(
        agreementProposalId,
      );
      const finalHasProposal = await agreements.hasProposal(
        spaceId,
        proposalIdToAccept,
      );

      console.log(
        `Proposal ${agreementProposalId} executed: ${finalProposalData.executed}`,
      );
      console.log(
        `Agreement ${proposalIdToAccept} accepted in space ${spaceId}: ${finalHasProposal}`,
      );

      if (finalProposalData.executed && finalHasProposal) {
        console.log(
          '\n✅ TEST SUCCESSFUL: The proposal was executed and the agreement was accepted.',
        );
      } else if (finalProposalData.executed && !finalHasProposal) {
        console.log(
          '\n⚠️ PARTIAL SUCCESS: The proposal was executed but the agreement was not accepted.',
        );
      } else if (!finalProposalData.executed && finalHasProposal) {
        console.log(
          '\n⚠️ INCONSISTENT STATE: The proposal shows as not executed but the agreement was accepted.',
        );
      } else {
        console.log(
          '\n❌ TEST FAILED: The proposal was not executed and the agreement was not accepted.',
        );
      }
    } catch (agreementProposalError) {
      console.error(
        'Agreement proposal creation failed:',
        agreementProposalError,
      );
    }
  } catch (spaceError) {
    console.error('Space creation failed:', spaceError);
  }
}

// Run the test
testAgreementProposal().catch(console.error);
