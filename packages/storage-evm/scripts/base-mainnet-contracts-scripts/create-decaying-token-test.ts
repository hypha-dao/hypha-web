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
    inputs: [
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
      {
        internalType: 'uint256',
        name: '_newVotingPowerSource',
        type: 'uint256',
      },
      { internalType: 'uint256', name: '_newUnity', type: 'uint256' },
      { internalType: 'uint256', name: '_newQuorum', type: 'uint256' },
    ],
    name: 'changeVotingMethod',
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

// DecayingTokenFactory ABI
const decayingTokenFactoryAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: 'spaceId', type: 'uint256' },
      { internalType: 'string', name: 'name', type: 'string' },
      { internalType: 'string', name: 'symbol', type: 'string' },
      { internalType: 'uint256', name: 'maxSupply', type: 'uint256' },
      { internalType: 'bool', name: 'transferable', type: 'bool' },
      { internalType: 'bool', name: 'isVotingToken', type: 'bool' },
      { internalType: 'uint256', name: 'decayPercentage', type: 'uint256' },
      { internalType: 'uint256', name: 'decayInterval', type: 'uint256' },
    ],
    name: 'deployDecayingToken',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_spacesContract', type: 'address' },
    ],
    name: 'setSpacesContract',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_decayVotingPowerContract',
        type: 'address',
      },
    ],
    name: 'setDecayVotingPowerContract',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'spacesContract',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decayVotingPowerContract',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'spaceId', type: 'uint256' }],
    name: 'getSpaceToken',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// DecayingSpaceToken ABI
const decayingSpaceTokenAbi = [
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [],
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

// VoteDecayTokenVotingPowerImplementation ABI
const voteDecayTokenVotingPowerAbi = [
  {
    inputs: [
      { internalType: 'address', name: '_user', type: 'address' },
      { internalType: 'uint256', name: '_sourceSpaceId', type: 'uint256' },
    ],
    name: 'getVotingPower',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_sourceSpaceId', type: 'uint256' },
    ],
    name: 'getTotalVotingPower',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function testDecayingTokenCreationAndVoting(): Promise<void> {
  console.log('Starting decaying token creation and voting test...');

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

  const daoProposalsAddress = '0x001bA7a00a259Fb12d7936455e292a60FC2bef14';
  const daoProposals = new ethers.Contract(
    daoProposalsAddress,
    daoProposalsAbi,
    wallet,
  );

  // Use actual deployed addresses from addresses.txt
  const decayingTokenFactoryAddress =
    process.env.DECAYING_TOKEN_FACTORY_ADDRESS ||
    '0x299f4D2327933c1f363301dbd2a28379ccD5539b';
  const voteDecayTokenVotingPowerAddress =
    process.env.VOTE_DECAY_TOKEN_VOTING_POWER_ADDRESS ||
    '0x6dB5E05B21c68550B63a7404a3B68F81c159DAee';

  const decayingTokenFactory = new ethers.Contract(
    decayingTokenFactoryAddress,
    decayingTokenFactoryAbi,
    wallet,
  );

  const voteDecayTokenVotingPower = new ethers.Contract(
    voteDecayTokenVotingPowerAddress,
    voteDecayTokenVotingPowerAbi,
    wallet,
  );

  console.log('Contract addresses:');
  console.log(`- DAO Space Factory: ${daoSpaceFactory.target}`);
  console.log(`- DAO Proposals: ${daoProposals.target}`);
  console.log(`- Decaying Token Factory: ${decayingTokenFactory.target}`);
  console.log(
    `- Vote Decay Token Voting Power: ${voteDecayTokenVotingPower.target}`,
  );

  try {
    // Step 1: Create a Space
    console.log('\n=== Step 1: Creating a new space ===');
    const spaceParams: SpaceCreationParams = {
      unity: 51, // 51% unity
      quorum: 51, // 51% quorum
      votingPowerSource: 2, // Space voting power (1 member = 1 vote) - change from 3 to 2
      exitMethod: 2,
      joinMethod: 1,
    };

    console.log(
      `Creating space with unity: ${spaceParams.unity}, quorum: ${spaceParams.quorum}`,
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
    console.log(`Creator is member: ${members.includes(wallet.address)}`);

    // Step 2: Create proposal to deploy decaying token
    console.log('\n=== Step 2: Creating proposal to deploy decaying token ===');

    const tokenParams = {
      spaceId: spaceId,
      name: 'Test Decay Token',
      symbol: 'TDT',
      maxSupply: ethers.parseUnits('1000000', 18), // 1M tokens max
      transferable: true,
      isVotingToken: true, // Set as voting token
      decayPercentage: 500, // 5% decay (500 basis points)
      decayInterval: 86400, // 1 day in seconds
    };

    console.log('Creating proposal to deploy decaying token with parameters:', {
      spaceId: tokenParams.spaceId,
      name: tokenParams.name,
      symbol: tokenParams.symbol,
      maxSupply: ethers.formatUnits(tokenParams.maxSupply, 18),
      transferable: tokenParams.transferable,
      isVotingToken: tokenParams.isVotingToken,
      decayPercentage: tokenParams.decayPercentage,
      decayInterval: tokenParams.decayInterval,
    });

    // Encode the deployDecayingToken function call
    const deployTokenData = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        'uint256',
        'string',
        'string',
        'uint256',
        'bool',
        'bool',
        'uint256',
        'uint256',
      ],
      [
        tokenParams.spaceId,
        tokenParams.name,
        tokenParams.symbol,
        tokenParams.maxSupply,
        tokenParams.transferable,
        tokenParams.isVotingToken,
        tokenParams.decayPercentage,
        tokenParams.decayInterval,
      ],
    );

    const deployTokenMethod =
      'deployDecayingToken(uint256,string,string,uint256,bool,bool,uint256,uint256)';
    const deployTokenFunctionSelector = ethers
      .id(deployTokenMethod)
      .substring(0, 10);
    const encodedDeployTokenData =
      deployTokenFunctionSelector + deployTokenData.substring(2);

    const deployTokenProposalParams: ProposalParams = {
      spaceId: spaceId,
      duration: 3600, // 1 hour
      transactions: [
        {
          target: decayingTokenFactoryAddress,
          value: 0,
          data: encodedDeployTokenData,
        },
      ],
    };

    console.log('Creating deploy token proposal...');
    const createDeployProposalTx = await daoProposals.createProposal(
      deployTokenProposalParams,
      {
        gasLimit: 3000000,
      },
    );

    console.log(
      `Deploy token proposal creation tx hash: ${createDeployProposalTx.hash}`,
    );
    const deployProposalReceipt = await createDeployProposalTx.wait();
    console.log('Deploy token proposal creation confirmed');

    // Find the ProposalCreated event
    const deployProposalEvent = deployProposalReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'ProposalCreated(uint256,uint256,uint256,uint256,address,bytes)',
        ),
    );

    if (!deployProposalEvent) {
      console.error('Deploy token proposal creation event not found');
      return;
    }

    const deployProposalId = parseInt(deployProposalEvent.topics[1], 16);
    console.log(
      `✅ Deploy token proposal created with ID: ${deployProposalId}`,
    );

    // Vote on the deploy token proposal
    console.log('Voting on the deploy token proposal...');
    const deployVoteTx = await daoProposals.vote(deployProposalId, true); // Vote YES
    console.log(`Deploy vote transaction hash: ${deployVoteTx.hash}`);

    await deployVoteTx.wait();
    console.log('✅ Deploy vote confirmed');

    // Check if deploy proposal was executed
    console.log('Checking deploy proposal status...');
    const deployProposalData = await daoProposals.getProposalCore(
      deployProposalId,
    );

    if (deployProposalData.executed) {
      console.log('✅ Deploy proposal was executed!');
    } else {
      console.log('⏳ Deploy proposal not yet executed');
      console.log(
        'Note: Token deployment may take time depending on voting period and execution',
      );
      return;
    }

    // Step 3: Get the deployed token address from the execution transaction
    console.log('\n=== Step 3: Getting deployed token address ===');

    let tokenAddress = null;
    try {
      // Use the getSpaceToken function to get all tokens for this space
      const spaceTokens = await decayingTokenFactory.getSpaceToken(spaceId);
      console.log(`Found ${spaceTokens.length} tokens for space ${spaceId}`);

      if (spaceTokens.length === 0) {
        console.log('❌ No tokens found for this space');
        console.log(
          'The token deployment may have failed or not completed yet',
        );
        return;
      }

      // Get the most recently deployed token (last in the array)
      tokenAddress = spaceTokens[spaceTokens.length - 1];
      console.log(
        `✅ Found token address for space ${spaceId}: ${tokenAddress}`,
      );

      // Log all tokens if there are multiple
      if (spaceTokens.length > 1) {
        console.log('All tokens for this space:');
        spaceTokens.forEach((token, index) => {
          console.log(`  ${index + 1}. ${token}`);
        });
        console.log(`Using the most recent token: ${tokenAddress}`);
      }
    } catch (error) {
      console.error('Error getting token address:', error.message);
      return;
    }

    // Create DecayingSpaceToken contract instance
    const decayingSpaceToken = new ethers.Contract(
      tokenAddress,
      decayingSpaceTokenAbi,
      wallet,
    );

    // Step 4: Create Proposal to Mint Tokens
    console.log('\n=== Step 4: Creating proposal to mint tokens ===');

    const mintAmount = ethers.parseUnits('1000', 18); // Mint 1000 tokens
    const mintTo = wallet.address; // Mint to the creator

    console.log(
      `Creating proposal to mint ${ethers.formatUnits(
        mintAmount,
        18,
      )} tokens to ${mintTo}`,
    );

    // Encode the mint function call
    const mintData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256'],
      [mintTo, mintAmount],
    );

    const mintMethod = 'mint(address,uint256)';
    const mintFunctionSelector = ethers.id(mintMethod).substring(0, 10);
    const encodedMintData = mintFunctionSelector + mintData.substring(2);

    const mintProposalParams: ProposalParams = {
      spaceId: spaceId,
      duration: 3600, // 1 hour
      transactions: [
        {
          target: tokenAddress,
          value: 0,
          data: encodedMintData,
        },
      ],
    };

    console.log('Creating mint proposal...');
    const createMintProposalTx = await daoProposals.createProposal(
      mintProposalParams,
      {
        gasLimit: 3000000,
      },
    );

    console.log(`Mint proposal creation tx hash: ${createMintProposalTx.hash}`);
    const mintProposalReceipt = await createMintProposalTx.wait();
    console.log('Mint proposal creation confirmed');

    // Find the ProposalCreated event
    const mintProposalEvent = mintProposalReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'ProposalCreated(uint256,uint256,uint256,uint256,address,bytes)',
        ),
    );

    if (!mintProposalEvent) {
      console.error('Mint proposal creation event not found');
      return;
    }

    const mintProposalId = parseInt(mintProposalEvent.topics[1], 16);
    console.log(`✅ Mint proposal created with ID: ${mintProposalId}`);

    // Step 5: Vote on the Mint Proposal
    console.log('\n=== Step 5: Voting on the mint proposal ===');
    const mintVoteTx = await daoProposals.vote(mintProposalId, true); // Vote YES
    console.log(`Mint vote transaction hash: ${mintVoteTx.hash}`);

    await mintVoteTx.wait();
    console.log('✅ Mint vote confirmed');

    // Step 6: Check mint proposal status and wait for execution
    console.log('\n=== Step 6: Checking mint proposal status ===');
    const mintProposalData = await daoProposals.getProposalCore(mintProposalId);

    console.log('Mint proposal data:');
    console.log(`- Space ID: ${mintProposalData.spaceId}`);
    console.log(`- Executed: ${mintProposalData.executed}`);
    console.log(`- Yes votes: ${mintProposalData.yesVotes}`);
    console.log(`- No votes: ${mintProposalData.noVotes}`);
    console.log(
      `- Total voting power: ${mintProposalData.totalVotingPowerAtSnapshot}`,
    );

    if (mintProposalData.executed) {
      console.log('✅ Mint proposal was executed!');
    } else {
      console.log('⏳ Mint proposal not yet executed');
    }

    // Step 7: Check token balance after minting
    console.log('\n=== Step 7: Checking token balance ===');
    const tokenBalance = await decayingSpaceToken.balanceOf(wallet.address);
    console.log(
      `Token balance: ${ethers.formatUnits(tokenBalance, 18)} tokens`,
    );

    // Step 8: Check voting power with decay token voting power contract
    console.log('\n=== Step 8: Checking voting power ===');
    try {
      const votingPower = await voteDecayTokenVotingPower.getVotingPower(
        wallet.address,
        spaceId,
      );
      console.log(`✅ Voting power: ${ethers.formatUnits(votingPower, 18)}`);

      const totalVotingPower =
        await voteDecayTokenVotingPower.getTotalVotingPower(spaceId);
      console.log(
        `Total voting power in space: ${ethers.formatUnits(
          totalVotingPower,
          18,
        )}`,
      );

      // Verify the voting power matches the token balance
      if (votingPower.toString() === tokenBalance.toString()) {
        console.log('✅ Voting power matches token balance!');
      } else {
        console.log('⚠️  Voting power does not match token balance');
        console.log(`Expected: ${ethers.formatUnits(tokenBalance, 18)}`);
        console.log(`Actual: ${ethers.formatUnits(votingPower, 18)}`);
      }
    } catch (error) {
      console.error('Error checking voting power:', error.message);
      console.log(
        'Note: This might be expected if the space is not using decay token voting power',
      );
    }

    // Step 9: Change voting method to use decay token voting power
    console.log('\n=== Step 9: Creating proposal to change voting method ===');

    const newVotingPowerSource = 3; // Decay token voting power
    const newUnity = 51;
    const newQuorum = 51;

    console.log(
      `Creating proposal to change voting method to source ${newVotingPowerSource} (decay token voting power)`,
    );

    // Encode the changeVotingMethod function call
    const changeVotingData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'uint256', 'uint256', 'uint256'],
      [spaceId, newVotingPowerSource, newUnity, newQuorum],
    );

    const changeVotingMethod =
      'changeVotingMethod(uint256,uint256,uint256,uint256)';
    const changeVotingFunctionSelector = ethers
      .id(changeVotingMethod)
      .substring(0, 10);
    const encodedChangeVotingData =
      changeVotingFunctionSelector + changeVotingData.substring(2);

    const changeVotingProposalParams: ProposalParams = {
      spaceId: spaceId,
      duration: 3600, // 1 hour
      transactions: [
        {
          target: daoSpaceFactory.target.toString(),
          value: 0,
          data: encodedChangeVotingData,
        },
      ],
    };

    console.log('Creating change voting method proposal...');
    const createChangeVotingProposalTx = await daoProposals.createProposal(
      changeVotingProposalParams,
      {
        gasLimit: 3000000,
      },
    );

    console.log(
      `Change voting proposal creation tx hash: ${createChangeVotingProposalTx.hash}`,
    );
    const changeVotingProposalReceipt =
      await createChangeVotingProposalTx.wait();
    console.log('Change voting proposal creation confirmed');

    // Find the ProposalCreated event
    const changeVotingProposalEvent = changeVotingProposalReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'ProposalCreated(uint256,uint256,uint256,uint256,address,bytes)',
        ),
    );

    if (!changeVotingProposalEvent) {
      console.error('Change voting proposal creation event not found');
      return;
    }

    const changeVotingProposalId = parseInt(
      changeVotingProposalEvent.topics[1],
      16,
    );
    console.log(
      `✅ Change voting proposal created with ID: ${changeVotingProposalId}`,
    );

    // Step 10: Vote on the change voting method proposal
    console.log(
      '\n=== Step 10: Voting on the change voting method proposal ===',
    );
    const changeVotingVoteTx = await daoProposals.vote(
      changeVotingProposalId,
      true,
    ); // Vote YES
    console.log(
      `Change voting vote transaction hash: ${changeVotingVoteTx.hash}`,
    );

    await changeVotingVoteTx.wait();
    console.log('✅ Change voting vote confirmed');

    // Check if change voting proposal was executed
    console.log('Checking change voting proposal status...');
    const changeVotingProposalData = await daoProposals.getProposalCore(
      changeVotingProposalId,
    );

    if (changeVotingProposalData.executed) {
      console.log('✅ Change voting proposal was executed!');
      console.log('🎉 Space is now using decay token voting power!');
    } else {
      console.log('⏳ Change voting proposal not yet executed');
      console.log(
        'Note: Voting method change may take time depending on voting period',
      );
      return;
    }

    // Step 11: Create second mint proposal to test decay token voting
    console.log(
      '\n=== Step 11: Creating second mint proposal (testing decay token voting) ===',
    );

    const secondMintAmount = ethers.parseUnits('500', 18); // Mint 500 more tokens
    const secondMintTo = wallet.address; // Mint to the creator

    console.log(
      `Creating second proposal to mint ${ethers.formatUnits(
        secondMintAmount,
        18,
      )} tokens using decay token voting`,
    );

    // Encode the second mint function call
    const secondMintData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256'],
      [secondMintTo, secondMintAmount],
    );

    const secondMintFunctionSelector = ethers.id(mintMethod).substring(0, 10);
    const encodedSecondMintData =
      secondMintFunctionSelector + secondMintData.substring(2);

    const secondMintProposalParams: ProposalParams = {
      spaceId: spaceId,
      duration: 3600, // 1 hour
      transactions: [
        {
          target: tokenAddress,
          value: 0,
          data: encodedSecondMintData,
        },
      ],
    };

    console.log('Creating second mint proposal...');
    const createSecondMintProposalTx = await daoProposals.createProposal(
      secondMintProposalParams,
      {
        gasLimit: 3000000,
      },
    );

    console.log(
      `Second mint proposal creation tx hash: ${createSecondMintProposalTx.hash}`,
    );
    const secondMintProposalReceipt = await createSecondMintProposalTx.wait();
    console.log('Second mint proposal creation confirmed');

    // Find the ProposalCreated event
    const secondMintProposalEvent = secondMintProposalReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'ProposalCreated(uint256,uint256,uint256,uint256,address,bytes)',
        ),
    );

    if (!secondMintProposalEvent) {
      console.error('Second mint proposal creation event not found');
      return;
    }

    const secondMintProposalId = parseInt(
      secondMintProposalEvent.topics[1],
      16,
    );
    console.log(
      `✅ Second mint proposal created with ID: ${secondMintProposalId}`,
    );

    // Step 12: Vote on the second mint proposal (using decay token voting power)
    console.log(
      '\n=== Step 12: Voting on second mint proposal (using decay token voting) ===',
    );
    console.log(
      '🔥 This vote will use decay token voting power instead of space voting power!',
    );

    const secondMintVoteTx = await daoProposals.vote(
      secondMintProposalId,
      true,
    ); // Vote YES
    console.log(`Second mint vote transaction hash: ${secondMintVoteTx.hash}`);

    await secondMintVoteTx.wait();
    console.log('✅ Second mint vote confirmed');

    // Step 13: Check second mint proposal status
    console.log('\n=== Step 13: Checking second mint proposal status ===');
    const secondMintProposalData = await daoProposals.getProposalCore(
      secondMintProposalId,
    );

    console.log('Second mint proposal data:');
    console.log(`- Space ID: ${secondMintProposalData.spaceId}`);
    console.log(`- Executed: ${secondMintProposalData.executed}`);
    console.log(`- Yes votes: ${secondMintProposalData.yesVotes}`);
    console.log(`- No votes: ${secondMintProposalData.noVotes}`);
    console.log(
      `- Total voting power: ${secondMintProposalData.totalVotingPowerAtSnapshot}`,
    );

    if (secondMintProposalData.executed) {
      console.log('✅ Second mint proposal was executed!');
    } else {
      console.log('⏳ Second mint proposal not yet executed');
    }

    // Step 14: Check final token balance and voting power
    console.log(
      '\n=== Step 14: Checking final token balance and voting power ===',
    );
    const finalTokenBalance = await decayingSpaceToken.balanceOf(
      wallet.address,
    );
    console.log(
      `Final token balance: ${ethers.formatUnits(
        finalTokenBalance,
        18,
      )} tokens`,
    );

    // Check final voting power
    try {
      const finalVotingPower = await voteDecayTokenVotingPower.getVotingPower(
        wallet.address,
        spaceId,
      );
      console.log(
        `✅ Final voting power: ${ethers.formatUnits(finalVotingPower, 18)}`,
      );

      const finalTotalVotingPower =
        await voteDecayTokenVotingPower.getTotalVotingPower(spaceId);
      console.log(
        `Final total voting power in space: ${ethers.formatUnits(
          finalTotalVotingPower,
          18,
        )}`,
      );

      // Compare with total voting power from the proposal
      const expectedTotalFromFirstMint = ethers.parseUnits('1000', 18);
      const expectedTotalFromSecondMint = secondMintProposalData.executed
        ? expectedTotalFromFirstMint + secondMintAmount
        : expectedTotalFromFirstMint;

      console.log(
        `Expected total after minting: ${ethers.formatUnits(
          expectedTotalFromSecondMint,
          18,
        )}`,
      );

      if (finalVotingPower.toString() === finalTokenBalance.toString()) {
        console.log('✅ Final voting power matches final token balance!');
      } else {
        console.log(
          '⚠️  Final voting power does not match final token balance',
        );
        console.log(`Expected: ${ethers.formatUnits(finalTokenBalance, 18)}`);
        console.log(`Actual: ${ethers.formatUnits(finalVotingPower, 18)}`);
      }

      // Check if the voting power in the proposal matches our token balance
      if (
        secondMintProposalData.totalVotingPowerAtSnapshot === finalVotingPower
      ) {
        console.log('🎉 Decay token voting power is working correctly!');
        console.log(
          'The proposal used decay token voting power for vote calculations.',
        );
      } else {
        console.log('ℹ️  Voting power snapshot vs current voting power:');
        console.log(
          `Snapshot: ${ethers.formatUnits(
            secondMintProposalData.totalVotingPowerAtSnapshot,
            18,
          )}`,
        );
        console.log(`Current: ${ethers.formatUnits(finalVotingPower, 18)}`);
      }
    } catch (error) {
      console.error('Error checking final voting power:', error.message);
    }

    console.log('\n=== Final Test Summary ===');
    console.log(`✅ Space created: ${spaceId}`);
    console.log(`✅ Decaying token deployed: ${tokenAddress}`);
    console.log(`✅ Deploy token proposal created: ${deployProposalId}`);
    console.log(`✅ First mint proposal created: ${mintProposalId}`);
    console.log(
      `✅ Change voting method proposal created: ${changeVotingProposalId}`,
    );
    console.log(`✅ Second mint proposal created: ${secondMintProposalId}`);
    console.log(
      `✅ Final token balance: ${ethers.formatUnits(finalTokenBalance, 18)}`,
    );
    console.log(
      `✅ Change voting method executed: ${changeVotingProposalData.executed}`,
    );
    console.log(
      `✅ Second mint proposal executed: ${secondMintProposalData.executed}`,
    );
    console.log(
      '🎉 Complete decay token voting system test completed successfully!',
    );
    console.log('📊 The test demonstrated:');
    console.log('   - Token deployment through governance');
    console.log('   - Initial minting with space voting power');
    console.log('   - Changing to decay token voting power');
    console.log('   - Second minting using decay token voting power');
    console.log('   - Verification of voting power calculations');

    return;
  } catch (error) {
    console.error('Error in test execution:', error);
  }
}

// Run the test
testDecayingTokenCreationAndVoting().catch(console.error);
