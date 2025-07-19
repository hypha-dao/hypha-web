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

// DAOSpaceFactory ABI
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

// DAOProposals ABI
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

async function testQuorumRoundingError(): Promise<void> {
  console.log('='.repeat(80));
  console.log('🧪 QUORUM ROUNDING ERROR TEST');
  console.log('='.repeat(80));
  console.log('📋 Test Scenario:');
  console.log('   - Space with 2 total voting power (simulating 2 members)');
  console.log('   - Quorum threshold: 51%');
  console.log('   - Unity threshold: 80%');
  console.log('   - Only 1 member votes YES');
  console.log('');
  console.log('🎯 Expected Behavior:');
  console.log('   - Required quorum: ceil(51% × 2) = ceil(1.02) = 2 votes');
  console.log('   - Actual votes cast: 1 vote');
  console.log('   - Result: Proposal should NOT execute (insufficient quorum)');
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

  if (accountData.length < 1) {
    console.error(
      '❌ Need at least 1 account. Please provide PRIVATE_KEY in .env',
    );
    return;
  }

  const wallet = new ethers.Wallet(accountData[0].privateKey, provider);
  console.log(`\n👤 Using wallet: ${wallet.address}`);

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

  const usdcAddress =
    process.env.USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  console.log(`\n🔗 Contract Addresses:`);
  console.log(`   DAO Space Factory: ${daoSpaceFactory.target}`);
  console.log(`   DAO Proposals: ${daoProposals.target}`);
  console.log(`   USDC: ${usdcAddress}`);

  try {
    // Step 1: Create Space with rounding-error-prone parameters
    console.log('\n🏗️  STEP 1: Creating space...');
    const spaceParams: SpaceCreationParams = {
      unity: 80, // 80% unity threshold
      quorum: 51, // 51% quorum threshold (potential rounding error)
      votingPowerSource: 2, // Space voting power (1 member = 1 vote)
      exitMethod: 0,
      joinMethod: 0,
    };

    console.log(`   Parameters:`);
    console.log(`   - Unity: ${spaceParams.unity}%`);
    console.log(`   - Quorum: ${spaceParams.quorum}%`);
    console.log(
      `   - Voting Power Source: ${spaceParams.votingPowerSource} (Space voting)`,
    );

    const tx = await daoSpaceFactory.createSpace(spaceParams);
    console.log(`   Transaction: ${tx.hash}`);

    const receipt = await tx.wait();

    const event = receipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'SpaceCreated(uint256,uint256,uint256,uint256,uint256,uint256,address,address)',
        ),
    );

    if (!event) {
      console.error('❌ Space creation event not found');
      return;
    }

    const spaceId = parseInt(event.topics[1], 16);
    console.log(`   ✅ Space created with ID: ${spaceId}`);

    // Step 2: Create a test proposal
    console.log('\n📝 STEP 2: Creating test proposal...');

    const transferData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256'],
      [wallet.address, 0], // Transfer 0 USDC (just for testing)
    );

    const functionSelector = ethers
      .id('transfer(address,uint256)')
      .substring(0, 10);
    const encodedData = functionSelector + transferData.substring(2);

    const proposalParams: ProposalParams = {
      spaceId: spaceId,
      duration: 300, // 5 minutes
      transactions: [
        {
          target: usdcAddress,
          value: 0,
          data: encodedData,
        },
      ],
    };

    const createProposalTx = await daoProposals.createProposal(proposalParams);
    console.log(`   Transaction: ${createProposalTx.hash}`);

    const createProposalReceipt = await createProposalTx.wait();

    const proposalEvent = createProposalReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'ProposalCreated(uint256,uint256,uint256,uint256,address,bytes)',
        ),
    );

    if (!proposalEvent) {
      console.error('❌ Proposal creation event not found');
      return;
    }

    const proposalId = parseInt(proposalEvent.topics[1], 16);
    console.log(`   ✅ Proposal created with ID: ${proposalId}`);

    // Step 3: Check initial state
    console.log('\n📊 STEP 3: Checking initial proposal state...');
    let proposalData = await daoProposals.getProposalCore(proposalId);
    const totalVotingPower = Number(proposalData.totalVotingPowerAtSnapshot);

    console.log(`   Total voting power at snapshot: ${totalVotingPower}`);
    console.log(`   Yes votes: ${proposalData.yesVotes}`);
    console.log(`   No votes: ${proposalData.noVotes}`);
    console.log(`   Executed: ${proposalData.executed}`);

    // Step 4: Cast the critical vote
    console.log('\n🗳️  STEP 4: Casting single vote...');
    console.log(`   📊 Math Preview:`);

    // Calculate with old method (floor division) vs new method (ceiling division)
    const oldRequiredQuorum = Math.floor((51 * totalVotingPower) / 100);
    const newRequiredQuorum = Math.ceil((51 * totalVotingPower) / 100);

    console.log(
      `   - Old calculation (floor): ${oldRequiredQuorum} votes required`,
    );
    console.log(
      `   - New calculation (ceiling): ${newRequiredQuorum} votes required`,
    );
    console.log(`   - Votes to be cast: 1`);
    console.log(
      `   - With old method: ${
        1 >= oldRequiredQuorum ? 'WOULD PASS ❌' : 'would fail ✅'
      }`,
    );
    console.log(
      `   - With new method: ${
        1 >= newRequiredQuorum ? 'WOULD PASS ❌' : 'would fail ✅'
      }`,
    );

    const voteTx = await daoProposals.vote(proposalId, true);
    console.log(`   Vote transaction: ${voteTx.hash}`);

    await voteTx.wait();
    console.log(`   ✅ Vote confirmed`);

    // Step 5: Check final state and analyze
    console.log('\n🔍 STEP 5: Final analysis...');
    proposalData = await daoProposals.getProposalCore(proposalId);

    const totalVotesCast =
      Number(proposalData.yesVotes) + Number(proposalData.noVotes);
    const yesVotes = Number(proposalData.yesVotes);
    const executed = proposalData.executed;

    console.log(`   📊 Final Results:`);
    console.log(`   - Total voting power: ${totalVotingPower}`);
    console.log(`   - Votes cast: ${totalVotesCast}`);
    console.log(`   - Yes votes: ${yesVotes}`);
    console.log(`   - Required quorum (51%): ${newRequiredQuorum} votes`);
    console.log(
      `   - Quorum reached: ${
        totalVotesCast >= newRequiredQuorum ? 'YES ✅' : 'NO ❌'
      }`,
    );

    if (totalVotesCast >= newRequiredQuorum) {
      const yesPercentage = (yesVotes * 100) / totalVotesCast;
      console.log(`   - Yes vote percentage: ${yesPercentage}%`);
      console.log(
        `   - Unity threshold (80%): ${
          yesPercentage >= 80 ? 'REACHED ✅' : 'NOT REACHED ❌'
        }`,
      );
    }

    console.log(`   - Proposal executed: ${executed ? 'YES' : 'NO'}`);

    // Final verdict
    console.log('\n🏁 FINAL VERDICT:');
    console.log('='.repeat(50));

    if (executed) {
      console.log('❌ TEST FAILED!');
      console.log('   The proposal was executed despite insufficient quorum.');
      console.log('   This indicates the rounding error still exists.');
      console.log('   Expected: Proposal should NOT execute with only 1 vote');
      console.log('   Actual: Proposal executed');
    } else {
      console.log('✅ TEST PASSED!');
      console.log('   The proposal was correctly NOT executed.');
      console.log('   The quorum rounding error has been fixed.');
      console.log('   Expected: Proposal should NOT execute with only 1 vote');
      console.log('   Actual: Proposal did not execute');
    }

    console.log('\n📋 Test Summary:');
    console.log(`   Space ID: ${spaceId}`);
    console.log(`   Proposal ID: ${proposalId}`);
    console.log(`   Total Voting Power: ${totalVotingPower}`);
    console.log(`   Required Quorum: ${newRequiredQuorum} votes`);
    console.log(`   Actual Votes Cast: ${totalVotesCast}`);
    console.log(
      `   Proposal Status: ${executed ? 'Executed' : 'Not Executed'}`,
    );
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    if (error.reason) {
      console.error(`   Reason: ${error.reason}`);
    }
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

// Run the test
console.log('Starting Quorum Rounding Error Test...\n');
testQuorumRoundingError().catch(console.error);
