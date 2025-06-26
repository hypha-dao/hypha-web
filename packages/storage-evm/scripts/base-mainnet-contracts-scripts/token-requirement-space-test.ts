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
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_spaceId',
        type: 'uint256',
      },
    ],
    name: 'joinSpace',
    outputs: [],
    stateMutability: 'nonpayable',
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

// TokenBalanceJoin ABI
const tokenBalanceJoinAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
      { internalType: 'address', name: '_token', type: 'address' },
      { internalType: 'uint256', name: '_requiredBalance', type: 'uint256' },
    ],
    name: 'setTokenRequirement',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_userAddress', type: 'address' },
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
    ],
    name: 'checkJoin',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// USDC ABI (ERC20)
const usdcAbi = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function testTokenRequirementSpace(): Promise<void> {
  console.log('Starting token requirement space test...');

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

  // If no accounts from JSON, try to use environment variables
  if (accountData.length === 0) {
    const privateKey = process.env.PRIVATE_KEY;
    const privateKey2 = process.env.PRIVATE_KEY2;

    if (privateKey && privateKey2) {
      console.log('Using private keys from environment variables.');
      try {
        // Remove 0x prefix if present
        const cleanPrivateKey = privateKey.startsWith('0x')
          ? privateKey.slice(2)
          : privateKey;
        const cleanPrivateKey2 = privateKey2.startsWith('0x')
          ? privateKey2.slice(2)
          : privateKey2;

        const wallet1 = new ethers.Wallet(cleanPrivateKey);
        const wallet2 = new ethers.Wallet(cleanPrivateKey2);

        accountData = [
          {
            privateKey: cleanPrivateKey,
            address: wallet1.address,
          },
          {
            privateKey: cleanPrivateKey2,
            address: wallet2.address,
          },
        ];
      } catch (error) {
        console.error(
          'Invalid private key format in environment variables:',
          error,
        );
      }
    } else {
      console.error(
        'PRIVATE_KEY and PRIVATE_KEY2 not found in environment variables.',
      );
    }
  }

  if (accountData.length < 2) {
    console.error(
      'Need at least 2 accounts. Please provide PRIVATE_KEY and PRIVATE_KEY2 in .env',
    );
    return;
  }

  const wallet1 = new ethers.Wallet(accountData[0].privateKey, provider);
  const wallet2 = new ethers.Wallet(accountData[1].privateKey, provider);

  console.log(`Using wallet 1 address: ${wallet1.address}`);
  console.log(`Using wallet 2 address: ${wallet2.address}`);

  // Contract addresses
  const daoSpaceFactoryAddress = '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';
  const daoProposalsAddress = '0x001bA7a00a259Fb12d7936455e292a60FC2bef14';
  const tokenBalanceJoinAddress = '0x41cD69A3a3715B16598415df336a8Cc533CCAF76';
  const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  // Initialize contracts
  const daoSpaceFactory = new ethers.Contract(
    daoSpaceFactoryAddress,
    daoSpaceFactoryAbi,
    wallet1,
  );

  const daoProposals = new ethers.Contract(
    daoProposalsAddress,
    daoProposalsAbi,
    wallet1,
  );

  const tokenBalanceJoin = new ethers.Contract(
    tokenBalanceJoinAddress,
    tokenBalanceJoinAbi,
    wallet1,
  );

  const usdc = new ethers.Contract(usdcAddress, usdcAbi, provider);

  console.log('Contract addresses:');
  console.log(`- DAO Space Factory: ${daoSpaceFactory.target}`);
  console.log(`- DAO Proposals: ${daoProposals.target}`);
  console.log(`- Token Balance Join: ${tokenBalanceJoin.target}`);
  console.log(`- USDC: ${usdc.target}`);

  try {
    // Check USDC balances
    console.log('\n=== Checking USDC balances ===');
    const wallet1Balance = await usdc.balanceOf(wallet1.address);
    const wallet2Balance = await usdc.balanceOf(wallet2.address);
    const decimals = await usdc.decimals();

    console.log(
      `Wallet 1 USDC balance: ${ethers.formatUnits(
        wallet1Balance,
        decimals,
      )} USDC`,
    );
    console.log(
      `Wallet 2 USDC balance: ${ethers.formatUnits(
        wallet2Balance,
        decimals,
      )} USDC`,
    );

    // Step 1: Create a Space with TokenBalanceJoin method
    console.log('\n=== Step 1: Creating a new space ===');
    const spaceParams: SpaceCreationParams = {
      unity: 51, // 51% unity
      quorum: 51, // 51% quorum
      votingPowerSource: 2, // Space voting power (1 member = 1 vote)
      exitMethod: 2,
      joinMethod: 1, // TokenBalanceJoin method ID (assuming it's 3)
    };

    console.log(
      `Creating space with unity: ${spaceParams.unity}, quorum: ${spaceParams.quorum}, joinMethod: ${spaceParams.joinMethod}`,
    );
    const createSpaceTx = await daoSpaceFactory.createSpace(spaceParams);
    console.log(`Space creation transaction submitted: ${createSpaceTx.hash}`);

    const spaceReceipt = await createSpaceTx.wait();
    console.log('Space creation transaction confirmed');

    // Find the SpaceCreated event
    const spaceEvent = spaceReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'SpaceCreated(uint256,uint256,uint256,uint256,uint256,uint256,address,address)',
        ),
    );

    if (!spaceEvent) {
      console.error('Space creation event not found in transaction receipt');
      return;
    }

    const spaceId = parseInt(spaceEvent.topics[1], 16);
    console.log(`✅ Space created with ID: ${spaceId}`);

    // Get space executor
    const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);
    console.log(`Space executor address: ${executorAddress}`);

    // Verify membership
    const members = await daoSpaceFactory.getSpaceMembers(spaceId);
    console.log(`Space members: ${members}`);
    console.log(`Creator is member: ${members.includes(wallet1.address)}`);

    // Step 2: Create proposal to set token requirement
    console.log('\n=== Step 2: Creating proposal to set token requirement ===');

    const requiredBalance = ethers.parseUnits('10000', 6); // 10,000 USDC (6 decimals)

    console.log('Creating proposal to set token requirement:', {
      spaceId: spaceId,
      token: usdcAddress,
      requiredBalance: ethers.formatUnits(requiredBalance, 6) + ' USDC',
    });

    // Encode the setTokenRequirement function call
    const setTokenRequirementData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'address', 'uint256'],
      [spaceId, usdcAddress, requiredBalance],
    );

    const setTokenRequirementMethod =
      'setTokenRequirement(uint256,address,uint256)';
    const setTokenRequirementSelector = ethers
      .id(setTokenRequirementMethod)
      .substring(0, 10);
    const encodedSetTokenRequirementData =
      setTokenRequirementSelector + setTokenRequirementData.substring(2);

    const tokenRequirementProposalParams: ProposalParams = {
      spaceId: spaceId,
      duration: 3600, // 1 hour
      transactions: [
        {
          target: tokenBalanceJoinAddress,
          value: 0,
          data: encodedSetTokenRequirementData,
        },
      ],
    };

    console.log('Creating token requirement proposal...');
    const createProposalTx = await daoProposals.createProposal(
      tokenRequirementProposalParams,
      {
        gasLimit: 3000000,
      },
    );

    console.log(
      `Token requirement proposal creation tx hash: ${createProposalTx.hash}`,
    );
    const proposalReceipt = await createProposalTx.wait();
    console.log('Token requirement proposal creation confirmed');

    // Find the ProposalCreated event
    const proposalEvent = proposalReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'ProposalCreated(uint256,uint256,uint256,uint256,address,bytes)',
        ),
    );

    if (!proposalEvent) {
      console.error('Token requirement proposal creation event not found');
      return;
    }

    const proposalId = parseInt(proposalEvent.topics[1], 16);
    console.log(`✅ Token requirement proposal created with ID: ${proposalId}`);

    // Vote on the proposal
    console.log('Voting on the token requirement proposal...');
    const voteTx = await daoProposals.vote(proposalId, true); // Vote YES
    console.log(`Vote transaction hash: ${voteTx.hash}`);

    await voteTx.wait();
    console.log('✅ Vote confirmed');

    // Check if proposal was executed
    console.log('Checking proposal status...');
    const proposalData = await daoProposals.getProposalCore(proposalId);

    console.log('Proposal data:');
    console.log(`- Space ID: ${proposalData.spaceId}`);
    console.log(`- Executed: ${proposalData.executed}`);
    console.log(`- Yes votes: ${proposalData.yesVotes}`);
    console.log(`- No votes: ${proposalData.noVotes}`);

    if (proposalData.executed) {
      console.log('✅ Token requirement proposal was executed!');
    } else {
      console.log('⏳ Token requirement proposal not yet executed');
      console.log(
        'Note: Token requirement may take time depending on voting period',
      );
      return;
    }

    // Step 3: Test join with second account
    console.log('\n=== Step 3: Testing join with second account ===');

    // Check if second wallet can join (should check token requirement)
    console.log('Checking if wallet 2 can join the space...');
    const canJoin = await tokenBalanceJoin.checkJoin(wallet2.address, spaceId);
    console.log(`Can wallet 2 join: ${canJoin}`);

    if (canJoin) {
      console.log('Wallet 2 meets token requirements. Attempting to join...');
    } else {
      console.log('Wallet 2 does not meet token requirements.');
      console.log(`Required: ${ethers.formatUnits(requiredBalance, 6)} USDC`);
      console.log(
        `Wallet 2 has: ${ethers.formatUnits(wallet2Balance, 6)} USDC`,
      );
    }

    // Attempt to join with second wallet regardless of balance check
    console.log('Attempting to join space with wallet 2...');
    const daoSpaceFactory2 = new ethers.Contract(
      daoSpaceFactoryAddress,
      daoSpaceFactoryAbi,
      wallet2,
    );

    try {
      const joinTx = await daoSpaceFactory2.joinSpace(spaceId);
      console.log(`Join transaction hash: ${joinTx.hash}`);
      await joinTx.wait();
      console.log('✅ Wallet 2 successfully joined the space!');

      // Verify updated membership
      const updatedMembers = await daoSpaceFactory.getSpaceMembers(spaceId);
      console.log(`Updated space members: ${updatedMembers}`);
      console.log(
        `Wallet 2 is now member: ${updatedMembers.includes(wallet2.address)}`,
      );
    } catch (error: any) {
      console.log('❌ Failed to join space:', error.message);
      if (error.message.includes('revert')) {
        console.log(
          'This is expected if wallet 2 does not have enough USDC tokens.',
        );
      }
    }

    console.log('\n=== Final Test Summary ===');
    console.log(`✅ Space created: ${spaceId}`);
    console.log(`✅ Token requirement proposal created: ${proposalId}`);
    console.log(
      `✅ Token requirement proposal executed: ${proposalData.executed}`,
    );
    console.log(
      `✅ Required balance: ${ethers.formatUnits(requiredBalance, 6)} USDC`,
    );
    console.log(
      `📊 Wallet 1 USDC: ${ethers.formatUnits(wallet1Balance, 6)} USDC`,
    );
    console.log(
      `📊 Wallet 2 USDC: ${ethers.formatUnits(wallet2Balance, 6)} USDC`,
    );
    console.log(`📊 Can wallet 2 join: ${canJoin}`);
    console.log('🎉 Token requirement space test completed!');
  } catch (error) {
    console.error('Error in test execution:', error);
  }
}

// Run the test
testTokenRequirementSpace().catch(console.error);
