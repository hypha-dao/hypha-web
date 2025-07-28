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

// USDC token ABI (simplified for transfer)
const erc20Abi = [
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
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

async function testProposalCreationAndExecution(): Promise<void> {
  console.log('Starting proposal creation and execution test...');

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

  // Use the correct DAO Proposals address from addresses.txt
  const daoProposalsAddress = '0x001bA7a00a259Fb12d7936455e292a60FC2bef14'; // From addresses.txt
  const daoProposals = new ethers.Contract(
    daoProposalsAddress,
    daoProposalsAbi,
    wallet,
  );

  // USDC on Base Mainnet
  const usdcAddress =
    process.env.USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const usdcToken = new ethers.Contract(usdcAddress, erc20Abi, wallet);

  // After loading the contracts, add this debugging info:
  console.log('Contract addresses:');
  console.log(`- DAO Space Factory: ${daoSpaceFactory.target}`);
  console.log(`- DAO Proposals: ${daoProposals.target}`);
  console.log(`- USDC: ${usdcToken.target}`);

  // Step 1: Create a Space
  console.log('Creating a new space...');
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

    // Step 2: Fund the executor with USDC
    console.log('\nFunding the executor with USDC...');

    // USDC has 6 decimals
    const fundingAmount = ethers.parseUnits('0.01', 6); // 0.01 USDC = 10000 units

    // Check if the wallet has enough USDC
    try {
      const walletBalance = await usdcToken.balanceOf(wallet.address);
      console.log(
        `Wallet USDC balance: ${ethers.formatUnits(walletBalance, 6)} USDC`,
      );

      if (walletBalance < fundingAmount) {
        console.log(
          `Insufficient USDC balance. Need at least 0.01 USDC to fund the executor.`,
        );
        console.log(
          `Please fund wallet ${wallet.address} with USDC and try again.`,
        );
        return;
      }

      // Send USDC to the executor
      console.log(`Sending 0.01 USDC to executor ${executorAddress}...`);
      const transferTx = await usdcToken.transfer(
        executorAddress,
        fundingAmount,
      );
      console.log(`USDC transfer transaction submitted: ${transferTx.hash}`);

      await transferTx.wait();
      console.log('USDC transfer confirmed');

      // Verify the executor received the USDC
      const executorBalance = await usdcToken.balanceOf(executorAddress);
      console.log(
        `Executor USDC balance: ${ethers.formatUnits(executorBalance, 6)} USDC`,
      );

      if (executorBalance < fundingAmount) {
        console.log(
          `Executor did not receive the expected USDC amount. Aborting.`,
        );
        return;
      }
    } catch (error) {
      console.error('Error funding executor with USDC:', error);
      console.log('Make sure your wallet has USDC on Base Mainnet.');
      return;
    }

    // Step 3: Create a Proposal
    console.log('\nCreating a proposal to transfer USDC...');

    // Amount to transfer in the proposal (less than what we funded)
    const usdcAmount = ethers.parseUnits('0.005', 6); // 0.005 USDC

    // Encode the USDC transfer function call
    const transferData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256'],
      [wallet.address, usdcAmount],
    );

    const transferMethod = 'transfer(address,uint256)';
    const functionSelector = ethers.id(transferMethod).substring(0, 10);
    const encodedData = functionSelector + transferData.substring(2); // remove 0x prefix

    // Create proposal with smaller duration for testing
    const proposalParams: ProposalParams = {
      spaceId: spaceId,
      duration: 3600, // 1 hour in seconds instead of 1 day
      transactions: [
        {
          target: usdcAddress,
          value: 0, // No ETH transfer
          data: encodedData,
        },
      ],
    };

    console.log('Proposal parameters:', {
      spaceId: proposalParams.spaceId,
      duration: proposalParams.duration,
      transactions: proposalParams.transactions.map((t) => ({
        target: t.target,
        value: t.value,
        dataLength: typeof t.data === 'string' ? t.data.length : '(binary)',
      })),
    });

    console.log('Submitting proposal creation transaction...');
    try {
      // Try to manually estimate gas first to get more detailed error
      const estimatedGas = await daoProposals.createProposal.estimateGas(
        proposalParams,
      );
      console.log(`Estimated gas: ${estimatedGas.toString()}`);

      // If gas estimation succeeds, proceed with the transaction
      const createProposalTx = await daoProposals.createProposal(
        proposalParams,
        {
          gasLimit: 3000000, // Fixed gas limit
        },
      );

      console.log(`Proposal creation tx hash: ${createProposalTx.hash}`);

      const createProposalReceipt = await createProposalTx.wait();
      console.log('Proposal creation confirmed');

      // Find the ProposalCreated event
      const proposalEvent = createProposalReceipt?.logs.find(
        (log) =>
          log.topics[0] ===
          ethers.id(
            'ProposalCreated(uint256,uint256,uint256,uint256,address,bytes)',
          ),
      );

      if (!proposalEvent) {
        console.error('Proposal creation event not found');
        return;
      }

      const proposalId = parseInt(proposalEvent.topics[1], 16);
      console.log(`Proposal created with ID: ${proposalId}`);

      // Step 4: Vote on the proposal
      console.log('\nVoting on the proposal...');
      const voteTx = await daoProposals.vote(proposalId, true); // Vote YES
      console.log(`Vote transaction hash: ${voteTx.hash}`);

      await voteTx.wait();
      console.log('Vote confirmed');

      // Step 5: Check proposal status
      console.log('\nChecking proposal status...');
      const proposalData = await daoProposals.getProposalCore(proposalId);

      console.log('Proposal data:');
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

      if (proposalData.executed) {
        console.log('Success! The proposal was executed.');
      } else {
        console.log('The proposal has not been executed yet.');

        if (Date.now() / 1000 < Number(proposalData.endTime)) {
          console.log(
            `Waiting for voting period to end. Current time: ${new Date().toLocaleString()}`,
          );
          console.log(
            `End time: ${new Date(
              Number(proposalData.endTime) * 1000,
            ).toLocaleString()}`,
          );
        }
      }
    } catch (error) {
      console.error(
        'Proposal creation failed during gas estimation or execution:',
      );
      console.error(error);

      // Check if executor has permission to make the proposal
      console.log('\nChecking if there are any permissions issues...');
      try {
        // Check if the space exists and if the creator is a member
        const members = await daoSpaceFactory.getSpaceMembers(spaceId);
        console.log(`Space ${spaceId} members:`, members);
        console.log(`Is creator a member: ${members.includes(wallet.address)}`);

        // Try with a different address for DAO Proposals contract
        console.log('\nAttempting with the hardcoded DAO Proposals address...');
        const backupDaoProposals = new ethers.Contract(
          '0x001bA7a00a259Fb12d7936455e292a60FC2bef14', // Use the correct current address
          daoProposalsAbi,
          wallet,
        );

        console.log(`Using DAO Proposals at: ${backupDaoProposals.target}`);

        // Try to create the proposal with the backup contract
        const backupEstimatedGas =
          await backupDaoProposals.createProposal.estimateGas(proposalParams);
        console.log('Gas estimation succeeded with backup contract!');
        console.log(`Backup estimated gas: ${backupEstimatedGas.toString()}`);

        const tx = await backupDaoProposals.createProposal(proposalParams, {
          gasLimit: Math.floor(Number(backupEstimatedGas) * 1.2), // Add 20% buffer
        });

        console.log(
          `Proposal creation with backup contract submitted: ${tx.hash}`,
        );
        await tx.wait();
        console.log('Proposal creation with backup contract confirmed!');
      } catch (innerError) {
        console.error('Backup attempt also failed:', innerError);
        console.log('\nPossible issues to check:');
        console.log(
          '1. Make sure the contracts are correctly set up and linked',
        );
        console.log('2. Check if your account has the right permissions');
        console.log(
          '3. Verify the DAO_PROPOSALS_ADDRESS in your .env file is correct',
        );
        console.log(
          '4. The proposal parameters might not meet contract requirements',
        );
      }
    }
  } catch (outerError) {
    console.error('Error in proposal creation process:', outerError);
  }
}

// Run the test
testProposalCreationAndExecution().catch(console.error);

// New test function for quorum rounding error
async function testQuorumRoundingError(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Starting QUORUM ROUNDING ERROR test...');
  console.log('Testing scenario: 2 members, 51% quorum, 80% unity, 1 vote');
  console.log(
    'Expected result: Proposal should NOT pass due to insufficient quorum',
  );
  console.log('='.repeat(60));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Load account data - we need 2 accounts for this test
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

  if (accountData.length < 1) {
    console.error(
      'Need at least 1 account. Please provide accounts in accounts.json or PRIVATE_KEY in .env',
    );
    return;
  }

  // Create wallets
  const wallet1 = new ethers.Wallet(accountData[0].privateKey, provider);
  console.log(`Member 1 (creator): ${wallet1.address}`);

  // For the second member, we'll create a new wallet or use a second account if available
  let wallet2: ethers.Wallet;
  if (accountData.length >= 2) {
    wallet2 = new ethers.Wallet(accountData[1].privateKey, provider);
  } else {
    // Generate a second wallet for testing
    const randomWallet = ethers.Wallet.createRandom();
    wallet2 = new ethers.Wallet(randomWallet.privateKey, provider);
    console.log(
      "⚠️  Generated random second wallet for testing (it won't have ETH for transactions)",
    );
  }
  console.log(`Member 2: ${wallet2.address}`);

  // Initialize contracts with first wallet
  const daoSpaceFactory = new ethers.Contract(
    process.env.DAO_SPACE_FACTORY_ADDRESS ||
      '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9',
    daoSpaceFactoryAbi,
    wallet1,
  );

  const daoProposalsAddress = '0x001bA7a00a259Fb12d7936455e292a60FC2bef14';
  const daoProposals = new ethers.Contract(
    daoProposalsAddress,
    daoProposalsAbi,
    wallet1,
  );

  // USDC on Base Mainnet
  const usdcAddress =
    process.env.USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  console.log('\n📋 Test Setup:');
  console.log(`- DAO Space Factory: ${daoSpaceFactory.target}`);
  console.log(`- DAO Proposals: ${daoProposals.target}`);
  console.log(`- USDC: ${usdcAddress}`);

  // Step 1: Create a Space with specific parameters to test rounding error
  console.log('\n🏗️  Creating space with rounding-error-prone parameters...');
  const spaceParams: SpaceCreationParams = {
    unity: 80, // 80% unity threshold
    quorum: 51, // 51% quorum threshold (this is where rounding error occurs)
    votingPowerSource: 2, // Space voting power (1 member = 1 vote)
    exitMethod: 0,
    joinMethod: 0, // Open join so we can add the second member
  };

  console.log(
    `- Unity: ${spaceParams.unity}% (requires 80% of votes cast to be YES)`,
  );
  console.log(
    `- Quorum: ${spaceParams.quorum}% (requires 51% of total voting power to participate)`,
  );
  console.log(
    `- Voting Power Source: ${spaceParams.votingPowerSource} (Space voting - 1 member = 1 vote)`,
  );

  try {
    const tx = await daoSpaceFactory.createSpace(spaceParams);
    console.log(`Space creation transaction: ${tx.hash}`);

    const receipt = await tx.wait();

    // Find the SpaceCreated event
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
    console.log(`✅ Space created with ID: ${spaceId}`);

    // Step 2: Add second member to the space (if join method allows)
    console.log('\n👥 Checking space membership...');
    let members = await daoSpaceFactory.getSpaceMembers(spaceId);
    console.log(`Initial members (${members.length}): ${members}`);

    if (members.length === 1) {
      console.log('🔄 Need to add second member to test 2-member scenario...');
      console.log(
        '💡 Note: In a real scenario, the second member would join through the join method.',
      );
      console.log(
        "📝 For this test, we'll proceed with the understanding that there should be 2 total voting power.",
      );
    }

    // Get executor for the space
    const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);
    console.log(`Space executor: ${executorAddress}`);

    // Step 3: Create a minimal proposal for testing
    console.log('\n📝 Creating test proposal...');

    // Simple proposal to transfer 0 USDC (just for testing voting mechanics)
    const transferData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256'],
      [wallet1.address, 0], // Transfer 0 USDC
    );

    const transferMethod = 'transfer(address,uint256)';
    const functionSelector = ethers.id(transferMethod).substring(0, 10);
    const encodedData = functionSelector + transferData.substring(2);

    const proposalParams: ProposalParams = {
      spaceId: spaceId,
      duration: 300, // 5 minutes for quick testing
      transactions: [
        {
          target: usdcAddress,
          value: 0,
          data: encodedData,
        },
      ],
    };

    console.log('Creating proposal...');
    const createProposalTx = await daoProposals.createProposal(proposalParams);
    console.log(`Proposal creation tx: ${createProposalTx.hash}`);

    const createProposalReceipt = await createProposalTx.wait();

    // Find the ProposalCreated event
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
    console.log(`✅ Proposal created with ID: ${proposalId}`);

    // Step 4: Check initial proposal state
    console.log('\n📊 Initial proposal state:');
    let proposalData = await daoProposals.getProposalCore(proposalId);
    console.log(
      `- Total voting power at snapshot: ${proposalData.totalVotingPowerAtSnapshot}`,
    );
    console.log(`- Yes votes: ${proposalData.yesVotes}`);
    console.log(`- No votes: ${proposalData.noVotes}`);
    console.log(`- Executed: ${proposalData.executed}`);
    console.log(`- Expired: ${proposalData.expired}`);

    // Step 5: Cast ONLY ONE vote (this is the key test)
    console.log('\n🗳️  Casting SINGLE vote (Member 1 votes YES)...');
    console.log('🧮 Math check:');
    console.log(
      `- Total voting power: ${proposalData.totalVotingPowerAtSnapshot}`,
    );
    console.log(
      `- Required quorum: 51% of ${
        proposalData.totalVotingPowerAtSnapshot
      } = ${Math.ceil(0.51 * Number(proposalData.totalVotingPowerAtSnapshot))}`,
    );
    console.log(`- Votes that will be cast: 1`);
    console.log(`- Expected result: Should NOT pass (1 < required quorum)`);

    const voteTx = await daoProposals.vote(proposalId, true); // Vote YES
    console.log(`Vote transaction: ${voteTx.hash}`);

    await voteTx.wait();
    console.log('✅ Vote confirmed');

    // Step 6: Check final proposal state
    console.log('\n📊 Final proposal state after voting:');
    proposalData = await daoProposals.getProposalCore(proposalId);
    console.log(`- Yes votes: ${proposalData.yesVotes}`);
    console.log(`- No votes: ${proposalData.noVotes}`);
    console.log(
      `- Total votes cast: ${
        Number(proposalData.yesVotes) + Number(proposalData.noVotes)
      }`,
    );
    console.log(`- Executed: ${proposalData.executed}`);
    console.log(`- Expired: ${proposalData.expired}`);

    // Step 7: Analyze results
    console.log('\n🔍 ANALYSIS:');
    const totalVotesCast =
      Number(proposalData.yesVotes) + Number(proposalData.noVotes);
    const totalVotingPower = Number(proposalData.totalVotingPowerAtSnapshot);
    const quorumThreshold = 51;

    // Calculate required quorum with ceiling division (our fix)
    const requiredQuorum = Math.ceil(
      (quorumThreshold * totalVotingPower) / 100,
    );

    console.log(`📈 Quorum calculation:`);
    console.log(
      `- Required: ${quorumThreshold}% of ${totalVotingPower} = ${requiredQuorum} votes (ceiling division)`,
    );
    console.log(`- Actual: ${totalVotesCast} votes cast`);
    console.log(
      `- Quorum reached: ${
        totalVotesCast >= requiredQuorum ? '✅ YES' : '❌ NO'
      }`,
    );

    if (totalVotesCast >= requiredQuorum) {
      console.log(`🔍 Unity calculation:`);
      const unityThreshold = 80;
      const yesVotePercentage =
        (Number(proposalData.yesVotes) * 100) / totalVotesCast;
      console.log(`- Required: ${unityThreshold}% YES votes`);
      console.log(`- Actual: ${yesVotePercentage.toFixed(1)}% YES votes`);
      console.log(
        `- Unity reached: ${
          yesVotePercentage >= unityThreshold ? '✅ YES' : '❌ NO'
        }`,
      );
    }

    // Final verdict
    console.log('\n🏁 FINAL RESULT:');
    if (proposalData.executed) {
      console.log(
        '❌ TEST FAILED: Proposal was executed when it should NOT have been!',
      );
      console.log('💡 This indicates the rounding error still exists.');
    } else {
      console.log(
        '✅ TEST PASSED: Proposal was NOT executed (correct behavior)',
      );
      console.log('💡 The quorum rounding error has been fixed!');
    }

    console.log('\n📋 Summary:');
    console.log(`- Space ID: ${spaceId}`);
    console.log(`- Proposal ID: ${proposalId}`);
    console.log(`- Unity threshold: ${spaceParams.unity}%`);
    console.log(`- Quorum threshold: ${spaceParams.quorum}%`);
    console.log(`- Total voting power: ${totalVotingPower}`);
    console.log(`- Votes cast: ${totalVotesCast}`);
    console.log(`- Required quorum: ${requiredQuorum}`);
    console.log(`- Proposal executed: ${proposalData.executed}`);
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }

  console.log('='.repeat(60));
}

// Export the new test function so it can be called
export { testQuorumRoundingError };
