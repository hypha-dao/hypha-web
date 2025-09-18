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
  target: string;
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
  {
    inputs: [{ internalType: 'uint256', name: '_spaceId', type: 'uint256' }],
    name: 'getSpaceDetails',
    outputs: [
      { internalType: 'uint256', name: 'unity', type: 'uint256' },
      { internalType: 'uint256', name: 'quorum', type: 'uint256' },
      { internalType: 'uint256', name: 'votingPowerSource', type: 'uint256' },
      { internalType: 'address[]', name: 'tokenAddresses', type: 'address[]' },
      { internalType: 'address[]', name: 'members', type: 'address[]' },
      { internalType: 'uint256', name: 'exitMethod', type: 'uint256' },
      { internalType: 'uint256', name: 'joinMethod', type: 'uint256' },
      { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
      { internalType: 'address', name: 'creator', type: 'address' },
      { internalType: 'address', name: 'executor', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
      { internalType: 'uint256', name: '_newJoinMethod', type: 'uint256' },
    ],
    name: 'changeEntryMethod',
    outputs: [],
    stateMutability: 'nonpayable',
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
];

async function testEntryMethodChange(): Promise<void> {
  console.log('='.repeat(80));
  console.log('🔄 ENTRY METHOD CHANGE TEST');
  console.log('='.repeat(80));
  console.log('Testing scenario:');
  console.log('1. Create space with invite-only entry method (joinMethod = 2)');
  console.log(
    '2. Create proposal to change entry method to open join (joinMethod = 0)',
  );
  console.log('3. Vote on and execute the proposal');
  console.log('4. Verify the entry method has changed');
  console.log('='.repeat(80));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Load account data
  let accountData: AccountData[] = [];
  try {
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) {
      accountData = JSON.parse(data);
    }
  } catch (error) {
    console.log('accounts.json not found. Using environment variables.');
  }

  // If no accounts from JSON, try to use environment variable
  if (accountData.length === 0) {
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey) {
      const cleanPrivateKey = privateKey.startsWith('0x')
        ? privateKey.slice(2)
        : privateKey;
      const wallet = new ethers.Wallet(cleanPrivateKey);
      accountData = [{ privateKey: cleanPrivateKey, address: wallet.address }];
    }
  }

  if (accountData.length === 0) {
    console.error(
      '❌ No accounts found. Please create an accounts.json file or provide a valid PRIVATE_KEY in .env',
    );
    return;
  }

  const wallet = new ethers.Wallet(accountData[0].privateKey, provider);
  console.log(`🔑 Using wallet address: ${wallet.address}`);

  // Initialize contracts
  const daoSpaceFactory = new ethers.Contract(
    process.env.DAO_SPACE_FACTORY_ADDRESS ||
      '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9',
    daoSpaceFactoryAbi,
    wallet,
  );

  const daoProposalsAddress = '0x001bA7a00a259Fb12d7936455e292a60FC2bef14';
  const daoProposals = new ethers.Contract(
    daoProposalsAddress,
    daoProposalsAbi,
    wallet,
  );

  console.log('\n📋 Contract addresses:');
  console.log(`- DAO Space Factory: ${daoSpaceFactory.target}`);
  console.log(`- DAO Proposals: ${daoProposals.target}`);

  try {
    // Step 1: Create a Space with invite-only entry method
    console.log(
      '\n🏗️  Step 1: Creating space with invite-only entry method...',
    );
    const spaceParams: SpaceCreationParams = {
      unity: 51, // 51% unity - simple majority
      quorum: 51, // 51% quorum - simple majority
      votingPowerSource: 2, // Space voting power (1 member = 1 vote)
      exitMethod: 0, // Not critical for this test
      joinMethod: 2, // Invite-only (creates proposals for joining)
    };

    console.log('🔧 Space parameters:');
    console.log(`- Unity: ${spaceParams.unity}%`);
    console.log(`- Quorum: ${spaceParams.quorum}%`);
    console.log(
      `- Voting Power Source: ${spaceParams.votingPowerSource} (Space voting)`,
    );
    console.log(`- Join Method: ${spaceParams.joinMethod} (Invite-only)`);

    const createSpaceTx = await daoSpaceFactory.createSpace(spaceParams);
    console.log(`📤 Space creation transaction: ${createSpaceTx.hash}`);

    const createSpaceReceipt = await createSpaceTx.wait();
    console.log('✅ Space creation confirmed');

    // Find the SpaceCreated event
    const spaceCreatedEvent = createSpaceReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'SpaceCreated(uint256,uint256,uint256,uint256,uint256,uint256,address,address)',
        ),
    );

    if (!spaceCreatedEvent) {
      console.error('❌ Space creation event not found');
      return;
    }

    const spaceId = parseInt(spaceCreatedEvent.topics[1], 16);
    console.log(`🆔 Space created with ID: ${spaceId}`);

    // Get space executor
    const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);
    console.log(`🤖 Space executor address: ${executorAddress}`);

    // Verify initial space details
    console.log('\n📊 Initial space details:');
    const initialDetails = await daoSpaceFactory.getSpaceDetails(spaceId);
    console.log(`- Unity: ${initialDetails.unity}%`);
    console.log(`- Quorum: ${initialDetails.quorum}%`);
    console.log(`- Voting Power Source: ${initialDetails.votingPowerSource}`);
    console.log(
      `- Join Method: ${initialDetails.joinMethod} (should be 2 - invite-only)`,
    );
    console.log(`- Exit Method: ${initialDetails.exitMethod}`);
    console.log(`- Members: ${initialDetails.members.length}`);
    console.log(`- Creator: ${initialDetails.creator}`);

    if (initialDetails.joinMethod !== BigInt(2)) {
      console.error(
        '❌ Initial join method is not 2 (invite-only). Something went wrong.',
      );
      return;
    }

    // Step 2: Create a proposal to change entry method
    console.log(
      '\n📝 Step 2: Creating proposal to change entry method to open join...',
    );

    // Encode the changeEntryMethod function call
    const changeEntryMethodData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'uint256'],
      [spaceId, 0], // Change to join method 0 (open join)
    );

    const changeEntryMethodSelector = ethers
      .id('changeEntryMethod(uint256,uint256)')
      .substring(0, 10);
    const encodedChangeEntryMethodData =
      changeEntryMethodSelector + changeEntryMethodData.substring(2);

    const proposalParams: ProposalParams = {
      spaceId: spaceId,
      duration: 3600, // 1 hour for quick testing
      transactions: [
        {
          target: daoSpaceFactory.target as string,
          value: 0,
          data: encodedChangeEntryMethodData,
        },
      ],
    };

    console.log('🔧 Proposal parameters:');
    console.log(`- Space ID: ${proposalParams.spaceId}`);
    console.log(
      `- Duration: ${proposalParams.duration} seconds (${
        proposalParams.duration / 60
      } minutes)`,
    );
    console.log(`- Target contract: ${proposalParams.transactions[0].target}`);
    console.log(`- Function: changeEntryMethod(${spaceId}, 0)`);

    const createProposalTx = await daoProposals.createProposal(proposalParams);
    console.log(`📤 Proposal creation transaction: ${createProposalTx.hash}`);

    const createProposalReceipt = await createProposalTx.wait();
    console.log('✅ Proposal creation confirmed');

    // Find the ProposalCreated event
    const proposalCreatedEvent = createProposalReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'ProposalCreated(uint256,uint256,uint256,uint256,address,bytes)',
        ),
    );

    if (!proposalCreatedEvent) {
      console.error('❌ Proposal creation event not found');
      return;
    }

    const proposalId = parseInt(proposalCreatedEvent.topics[1], 16);
    console.log(`🆔 Proposal created with ID: ${proposalId}`);

    // Step 3: Vote on the proposal
    console.log('\n🗳️  Step 3: Voting on the proposal...');
    const voteTx = await daoProposals.vote(proposalId, true); // Vote YES
    console.log(`📤 Vote transaction: ${voteTx.hash}`);

    await voteTx.wait();
    console.log('✅ Vote confirmed');

    // Step 4: Check proposal status and execution
    console.log('\n📊 Step 4: Checking proposal status...');
    const proposalData = await daoProposals.getProposalCore(proposalId);

    console.log('📈 Proposal data:');
    console.log(`- Space ID: ${proposalData.spaceId}`);
    console.log(
      `- Start time: ${new Date(
        Number(proposalData.startTime) * 1000,
      ).toLocaleString()}`,
    );
    console.log(
      `- End time: ${new Date(
        Number(proposalData.endTime) * 1000,
      ).toLocaleString()}`,
    );
    console.log(`- Executed: ${proposalData.executed}`);
    console.log(`- Expired: ${proposalData.expired}`);
    console.log(`- Yes votes: ${proposalData.yesVotes}`);
    console.log(`- No votes: ${proposalData.noVotes}`);
    console.log(
      `- Total voting power: ${proposalData.totalVotingPowerAtSnapshot}`,
    );
    console.log(`- Creator: ${proposalData.creator}`);

    // Step 5: Verify the entry method has changed
    console.log('\n🔍 Step 5: Verifying entry method change...');
    const finalDetails = await daoSpaceFactory.getSpaceDetails(spaceId);

    console.log('📊 Final space details:');
    console.log(`- Unity: ${finalDetails.unity}%`);
    console.log(`- Quorum: ${finalDetails.quorum}%`);
    console.log(`- Voting Power Source: ${finalDetails.votingPowerSource}`);
    console.log(
      `- Join Method: ${finalDetails.joinMethod} (should be 0 - open join)`,
    );
    console.log(`- Exit Method: ${finalDetails.exitMethod}`);
    console.log(`- Members: ${finalDetails.members.length}`);

    // Final analysis
    console.log('\n🏁 FINAL ANALYSIS:');
    console.log('='.repeat(50));

    if (proposalData.executed) {
      console.log('✅ Proposal was EXECUTED');

      if (finalDetails.joinMethod === BigInt(0)) {
        console.log(
          '🎉 SUCCESS! Entry method changed from invite-only (2) to open join (0)',
        );
        console.log(
          '💡 The space now allows anyone to join without requiring a proposal',
        );
      } else {
        console.log(
          `❌ FAILURE! Entry method is still ${finalDetails.joinMethod}, expected 0`,
        );
        console.log(
          '💡 The proposal executed but the entry method did not change as expected',
        );
      }
    } else {
      console.log('❌ Proposal was NOT executed');

      if (Date.now() / 1000 < Number(proposalData.endTime)) {
        console.log('⏳ Proposal is still in voting period');
        console.log(
          `⏰ Time remaining: ${Math.ceil(
            Number(proposalData.endTime) - Date.now() / 1000,
          )} seconds`,
        );
      } else {
        console.log('⏰ Proposal voting period has ended');

        const totalVotes =
          Number(proposalData.yesVotes) + Number(proposalData.noVotes);
        const requiredQuorum = Math.ceil(
          (51 * Number(proposalData.totalVotingPowerAtSnapshot)) / 100,
        );
        const yesPercentage =
          totalVotes > 0
            ? (Number(proposalData.yesVotes) * 100) / totalVotes
            : 0;

        console.log(`📊 Vote analysis:`);
        console.log(`- Total votes cast: ${totalVotes}`);
        console.log(`- Required quorum: ${requiredQuorum}`);
        console.log(
          `- Quorum reached: ${totalVotes >= requiredQuorum ? '✅' : '❌'}`,
        );
        console.log(`- Yes vote percentage: ${yesPercentage.toFixed(1)}%`);
        console.log(`- Unity threshold: 51%`);
        console.log(`- Unity reached: ${yesPercentage >= 51 ? '✅' : '❌'}`);
      }
    }

    console.log('\n📋 Test Summary:');
    console.log(`- Space ID: ${spaceId}`);
    console.log(`- Proposal ID: ${proposalId}`);
    console.log(`- Initial join method: 2 (invite-only)`);
    console.log(`- Target join method: 0 (open join)`);
    console.log(`- Final join method: ${finalDetails.joinMethod}`);
    console.log(`- Proposal executed: ${proposalData.executed}`);
    console.log(
      `- Test result: ${
        proposalData.executed && finalDetails.joinMethod === BigInt(0)
          ? '✅ SUCCESS'
          : '❌ FAILURE'
      }`,
    );
  } catch (error) {
    console.error('❌ Test failed with error:', error);

    // Additional error context
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      if (error.message.includes('revert')) {
        console.log('\n💡 Common issues to check:');
        console.log('1. Make sure you have enough ETH for gas fees');
        console.log('2. Verify the contract addresses are correct');
        console.log('3. Check if the wallet is a member of the space');
        console.log('4. Ensure the space executor has the right permissions');
      }
    }
  }

  console.log('='.repeat(80));
}

// Run the test
testEntryMethodChange().catch(console.error);
