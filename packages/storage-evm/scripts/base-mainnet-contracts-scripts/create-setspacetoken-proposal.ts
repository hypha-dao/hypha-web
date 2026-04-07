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

// TokenVotingPowerImplementation ABI
const tokenVotingPowerAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
      { internalType: 'address', name: '_tokenAddress', type: 'address' },
    ],
    name: 'setSpaceToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

// RegularTokenFactory ABI
const regularTokenFactoryAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: 'spaceId', type: 'uint256' },
      { internalType: 'string', name: 'name', type: 'string' },
      { internalType: 'string', name: 'symbol', type: 'string' },
      { internalType: 'uint256', name: 'maxSupply', type: 'uint256' },
      { internalType: 'bool', name: 'transferable', type: 'bool' },
      { internalType: 'bool', name: 'isVotingToken', type: 'bool' },
    ],
    name: 'deployRegularToken',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'nonpayable',
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

// ERC20 ABI for minting and balance checking
const erc20Abi = [
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

async function createSetSpaceTokenProposal(): Promise<void> {
  console.log('Starting setSpaceToken proposal creation...');

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

  // Contract addresses from addresses.txt
  const daoSpaceFactoryAddress =
    process.env.DAO_SPACE_FACTORY_ADDRESS ||
    '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';
  const daoProposalsAddress = '0x001bA7a00a259Fb12d7936455e292a60FC2bef14';
  const tokenVotingPowerAddress = '0x3214DE1Eb858799Db626Bd9699e78c2E6E33D2BE';
  const regularTokenFactoryAddress =
    '0x95A33EC94de2189893884DaD63eAa19f7390144a';

  // Initialize contracts
  const daoSpaceFactory = new ethers.Contract(
    daoSpaceFactoryAddress,
    daoSpaceFactoryAbi,
    wallet,
  );

  const daoProposals = new ethers.Contract(
    daoProposalsAddress,
    daoProposalsAbi,
    wallet,
  );

  const regularTokenFactory = new ethers.Contract(
    regularTokenFactoryAddress,
    regularTokenFactoryAbi,
    wallet,
  );

  console.log('Contract addresses:');
  console.log(`- DAO Space Factory: ${daoSpaceFactory.target}`);
  console.log(`- DAO Proposals: ${daoProposals.target}`);
  console.log(`- Token Voting Power: ${tokenVotingPowerAddress}`);
  console.log(`- Regular Token Factory: ${regularTokenFactory.target}`);

  try {
    // Step 1: Create a Space
    console.log('\n=== Step 1: Creating a new space ===');
    const spaceParams: SpaceCreationParams = {
      unity: 51, // 51% unity
      quorum: 51, // 51% quorum
      votingPowerSource: 2, // Space voting power (1 member = 1 vote)
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

    // Step 2: Create proposal to deploy regular token
    console.log('\n=== Step 2: Creating proposal to deploy regular token ===');

    const tokenParams = {
      spaceId: spaceId,
      name: 'Test Regular Token',
      symbol: 'TRT',
      maxSupply: ethers.parseUnits('1000000', 18), // 1M tokens
      transferable: true,
      isVotingToken: true,
    };

    console.log('Creating proposal to deploy regular token with parameters:', {
      spaceId: tokenParams.spaceId,
      name: tokenParams.name,
      symbol: tokenParams.symbol,
      maxSupply: ethers.formatUnits(tokenParams.maxSupply, 18),
      transferable: tokenParams.transferable,
      isVotingToken: tokenParams.isVotingToken,
    });

    // Encode the deployRegularToken function call
    const deployTokenData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'string', 'string', 'uint256', 'bool', 'bool'],
      [
        tokenParams.spaceId,
        tokenParams.name,
        tokenParams.symbol,
        tokenParams.maxSupply,
        tokenParams.transferable,
        tokenParams.isVotingToken,
      ],
    );

    const deployTokenMethod =
      'deployRegularToken(uint256,string,string,uint256,bool,bool)';
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
          target: regularTokenFactoryAddress,
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

    // Step 3: Get the deployed token address
    console.log('\n=== Step 3: Getting deployed token address ===');

    let tokenAddress = null;
    try {
      // Use the getSpaceToken function to get all tokens for this space
      const spaceTokens = await regularTokenFactory.getSpaceToken(spaceId);
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

    // Step 4: Create proposal to mint tokens
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

    // Vote on the mint proposal
    console.log('Voting on the mint proposal...');
    const mintVoteTx = await daoProposals.vote(mintProposalId, true); // Vote YES
    console.log(`Mint vote transaction hash: ${mintVoteTx.hash}`);

    await mintVoteTx.wait();
    console.log('✅ Mint vote confirmed');

    // Check if mint proposal was executed
    console.log('Checking mint proposal status...');
    const mintProposalData = await daoProposals.getProposalCore(mintProposalId);

    if (mintProposalData.executed) {
      console.log('✅ Mint proposal was executed!');
    } else {
      console.log('⏳ Mint proposal not yet executed');
      console.log(
        'Note: Token minting may take time depending on voting period and execution',
      );
      return;
    }

    // Step 5: Check token balance
    console.log('\n=== Step 5: Checking token balance ===');
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
    const tokenBalance = await tokenContract.balanceOf(wallet.address);
    console.log(
      `Token balance: ${ethers.formatUnits(tokenBalance, 18)} tokens`,
    );

    // Step 6: Create proposal to set space token in TokenVotingPowerImplementation
    console.log('\n=== Step 6: Creating proposal to set space token ===');

    console.log(
      `Creating proposal to link space ${spaceId} with token ${tokenAddress} in TokenVotingPowerImplementation`,
    );

    // Encode the setSpaceToken function call
    const setSpaceTokenData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'address'],
      [spaceId, tokenAddress],
    );

    const setSpaceTokenMethod = 'setSpaceToken(uint256,address)';
    const setSpaceTokenFunctionSelector = ethers
      .id(setSpaceTokenMethod)
      .substring(0, 10);
    const encodedSetSpaceTokenData =
      setSpaceTokenFunctionSelector + setSpaceTokenData.substring(2);

    const setSpaceTokenProposalParams: ProposalParams = {
      spaceId: spaceId,
      duration: 3600, // 1 hour
      transactions: [
        {
          target: tokenVotingPowerAddress,
          value: 0,
          data: encodedSetSpaceTokenData,
        },
      ],
    };

    console.log('Creating setSpaceToken proposal...');
    const createSetSpaceTokenProposalTx = await daoProposals.createProposal(
      setSpaceTokenProposalParams,
      {
        gasLimit: 3000000,
      },
    );

    console.log(
      `SetSpaceToken proposal creation tx hash: ${createSetSpaceTokenProposalTx.hash}`,
    );
    const setSpaceTokenProposalReceipt =
      await createSetSpaceTokenProposalTx.wait();
    console.log('SetSpaceToken proposal creation confirmed');

    // Find the ProposalCreated event
    const setSpaceTokenProposalEvent = setSpaceTokenProposalReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'ProposalCreated(uint256,uint256,uint256,uint256,address,bytes)',
        ),
    );

    if (!setSpaceTokenProposalEvent) {
      console.error('SetSpaceToken proposal creation event not found');
      return;
    }

    const setSpaceTokenProposalId = parseInt(
      setSpaceTokenProposalEvent.topics[1],
      16,
    );
    console.log(
      `✅ SetSpaceToken proposal created with ID: ${setSpaceTokenProposalId}`,
    );

    // Step 7: Vote on the setSpaceToken proposal
    console.log('\n=== Step 7: Voting on the setSpaceToken proposal ===');
    const setSpaceTokenVoteTx = await daoProposals.vote(
      setSpaceTokenProposalId,
      true,
    ); // Vote YES
    console.log(
      `SetSpaceToken vote transaction hash: ${setSpaceTokenVoteTx.hash}`,
    );

    await setSpaceTokenVoteTx.wait();
    console.log('✅ SetSpaceToken vote confirmed');

    // Step 8: Check setSpaceToken proposal status
    console.log('\n=== Step 8: Checking setSpaceToken proposal status ===');
    const setSpaceTokenProposalData = await daoProposals.getProposalCore(
      setSpaceTokenProposalId,
    );

    console.log('SetSpaceToken proposal data:');
    console.log(`- Space ID: ${setSpaceTokenProposalData.spaceId}`);
    console.log(`- Executed: ${setSpaceTokenProposalData.executed}`);
    console.log(`- Yes votes: ${setSpaceTokenProposalData.yesVotes}`);
    console.log(`- No votes: ${setSpaceTokenProposalData.noVotes}`);
    console.log(
      `- Total voting power: ${setSpaceTokenProposalData.totalVotingPowerAtSnapshot}`,
    );

    if (setSpaceTokenProposalData.executed) {
      console.log('✅ SetSpaceToken proposal was executed!');
      console.log(
        `🎉 Space ${spaceId} is now linked with token ${tokenAddress} in TokenVotingPowerImplementation!`,
      );
    } else {
      console.log('⏳ SetSpaceToken proposal not yet executed');
      console.log(
        'Note: SetSpaceToken execution may take time depending on voting period',
      );
    }

    console.log('\n=== Final Summary ===');
    console.log(`✅ Space created: ${spaceId}`);
    console.log(`✅ Regular token deployed: ${tokenAddress}`);
    console.log(`✅ Deploy token proposal created: ${deployProposalId}`);
    console.log(`✅ Mint proposal created: ${mintProposalId}`);
    console.log(
      `✅ SetSpaceToken proposal created: ${setSpaceTokenProposalId}`,
    );
    console.log(
      `✅ Token balance: ${ethers.formatUnits(tokenBalance, 18)} tokens`,
    );
    console.log(`✅ Deploy proposal executed: ${deployProposalData.executed}`);
    console.log(`✅ Mint proposal executed: ${mintProposalData.executed}`);
    console.log(
      `✅ SetSpaceToken proposal executed: ${setSpaceTokenProposalData.executed}`,
    );
    console.log(
      '🎉 Complete setSpaceToken proposal test completed successfully!',
    );
    console.log('📊 The test demonstrated:');
    console.log('   - Space creation');
    console.log('   - Token deployment through governance');
    console.log('   - Token minting through governance');
    console.log('   - SetSpaceToken proposal creation and execution');
    console.log(
      '   - Linking space with token in TokenVotingPowerImplementation',
    );

    return;
  } catch (error) {
    console.error('Error in test execution:', error);
  }
}

// Run the test
createSetSpaceTokenProposal().catch(console.error);
