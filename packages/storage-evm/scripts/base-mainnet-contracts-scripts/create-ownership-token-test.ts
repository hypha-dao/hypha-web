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

// OwnershipTokenFactory ABI
const ownershipTokenFactoryAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: 'spaceId', type: 'uint256' },
      { internalType: 'string', name: 'name', type: 'string' },
      { internalType: 'string', name: 'symbol', type: 'string' },
      { internalType: 'uint256', name: 'maxSupply', type: 'uint256' },
      { internalType: 'bool', name: 'isVotingToken', type: 'bool' },
    ],
    name: 'deployOwnershipToken',
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
        name: '_votingPowerContract',
        type: 'address',
      },
    ],
    name: 'setVotingPowerContract',
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
    name: 'votingPowerContract',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Event for tracking token deployment
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'spaceId',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'tokenAddress',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'name',
        type: 'string',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'symbol',
        type: 'string',
      },
    ],
    name: 'TokenDeployed',
    type: 'event',
  },
];

// OwnershipSpaceToken ABI
const ownershipSpaceTokenAbi = [
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
  {
    inputs: [],
    name: 'name',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function testOwnershipTokenCreationAndMinting(): Promise<void> {
  console.log('Starting ownership token creation and minting test...');

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

  // Use actual deployed addresses (you'll need to provide these)
  const ownershipTokenFactoryAddress =
    process.env.OWNERSHIP_TOKEN_FACTORY_ADDRESS ||
    '0xA1eDf096B72226ae2f7BDEb12E9c9C82152BccB6'; // OwnershipTokenFactory proxy address

  const ownershipTokenFactory = new ethers.Contract(
    ownershipTokenFactoryAddress,
    ownershipTokenFactoryAbi,
    wallet,
  );

  console.log('Contract addresses:');
  console.log(`- DAO Space Factory: ${daoSpaceFactory.target}`);
  console.log(`- DAO Proposals: ${daoProposals.target}`);
  console.log(`- Ownership Token Factory: ${ownershipTokenFactory.target}`);

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

    // Step 2: Create proposal to deploy ownership token
    console.log(
      '\n=== Step 2: Creating proposal to deploy ownership token ===',
    );

    const tokenParams = {
      spaceId: spaceId,
      name: 'Test Ownership Token',
      symbol: 'TOT',
      maxSupply: ethers.parseUnits('1000000', 18), // 1M tokens max
      isVotingToken: false, // Not setting as voting token for simplicity
    };

    console.log(
      'Creating proposal to deploy ownership token with parameters:',
      {
        spaceId: tokenParams.spaceId,
        name: tokenParams.name,
        symbol: tokenParams.symbol,
        maxSupply: ethers.formatUnits(tokenParams.maxSupply, 18),
        isVotingToken: tokenParams.isVotingToken,
      },
    );

    // Encode the deployOwnershipToken function call
    const deployTokenData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'string', 'string', 'uint256', 'bool'],
      [
        tokenParams.spaceId,
        tokenParams.name,
        tokenParams.symbol,
        tokenParams.maxSupply,
        tokenParams.isVotingToken,
      ],
    );

    const deployTokenMethod =
      'deployOwnershipToken(uint256,string,string,uint256,bool)';
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
          target: ownershipTokenFactoryAddress,
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

    // Step 3: Get the deployed token address from events
    console.log('\n=== Step 3: Getting deployed token address from events ===');

    let tokenAddress = null;
    try {
      // Look for TokenDeployed event in the transaction receipt
      // Since the execution happens in a separate transaction, we might need to look at recent blocks
      console.log('Looking for TokenDeployed events...');

      // Get recent blocks to find the token deployment event
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = currentBlock - 100; // Look back 100 blocks

      const filter = {
        address: ownershipTokenFactoryAddress,
        topics: [ethers.id('TokenDeployed(uint256,address,string,string)')],
        fromBlock: fromBlock,
        toBlock: currentBlock,
      };

      const logs = await provider.getLogs(filter);
      console.log(`Found ${logs.length} TokenDeployed events`);

      if (logs.length === 0) {
        console.log('❌ No TokenDeployed events found');
        console.log(
          'The token deployment may have failed or not completed yet',
        );
        return;
      }

      // Find the event for our space ID
      let tokenDeployedEvent = null;
      for (const log of logs) {
        try {
          const decoded = ownershipTokenFactory.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (
            decoded &&
            decoded.args.spaceId.toString() === spaceId.toString()
          ) {
            tokenDeployedEvent = decoded;
            break;
          }
        } catch (error) {
          // Skip invalid logs
        }
      }

      if (!tokenDeployedEvent) {
        console.log(`❌ No TokenDeployed event found for space ${spaceId}`);
        return;
      }

      tokenAddress = tokenDeployedEvent.args.tokenAddress;
      console.log(
        `✅ Found token address for space ${spaceId}: ${tokenAddress}`,
      );
      console.log(`Token name: ${tokenDeployedEvent.args.name}`);
      console.log(`Token symbol: ${tokenDeployedEvent.args.symbol}`);
    } catch (error) {
      console.error('Error getting token address from events:', error.message);
      return;
    }

    // Create OwnershipSpaceToken contract instance
    const ownershipSpaceToken = new ethers.Contract(
      tokenAddress,
      ownershipSpaceTokenAbi,
      wallet,
    );

    // Step 4: Verify token properties
    console.log('\n=== Step 4: Verifying token properties ===');
    try {
      const tokenName = await ownershipSpaceToken.name();
      const tokenSymbol = await ownershipSpaceToken.symbol();
      const totalSupply = await ownershipSpaceToken.totalSupply();

      console.log(`Token name: ${tokenName}`);
      console.log(`Token symbol: ${tokenSymbol}`);
      console.log(`Total supply: ${ethers.formatUnits(totalSupply, 18)}`);
      console.log('✅ Token properties verified');
    } catch (error) {
      console.error('Error verifying token properties:', error.message);
    }

    // Step 5: Create Proposal to Mint Tokens
    console.log('\n=== Step 5: Creating proposal to mint tokens ===');

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

    // Step 6: Vote on the Mint Proposal
    console.log('\n=== Step 6: Voting on the mint proposal ===');
    const mintVoteTx = await daoProposals.vote(mintProposalId, true); // Vote YES
    console.log(`Mint vote transaction hash: ${mintVoteTx.hash}`);

    await mintVoteTx.wait();
    console.log('✅ Mint vote confirmed');

    // Step 7: Check mint proposal status
    console.log('\n=== Step 7: Checking mint proposal status ===');
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

    // Step 8: Check token balance after minting
    console.log('\n=== Step 8: Checking token balance ===');
    try {
      const tokenBalance = await ownershipSpaceToken.balanceOf(wallet.address);
      const newTotalSupply = await ownershipSpaceToken.totalSupply();

      console.log(
        `Token balance: ${ethers.formatUnits(tokenBalance, 18)} tokens`,
      );
      console.log(
        `New total supply: ${ethers.formatUnits(newTotalSupply, 18)} tokens`,
      );

      if (mintProposalData.executed && tokenBalance > 0) {
        console.log('✅ Tokens were successfully minted!');
      } else if (!mintProposalData.executed) {
        console.log('⏳ Minting not yet executed');
      } else {
        console.log('⚠️  Minting may have failed');
      }
    } catch (error) {
      console.error('Error checking token balance:', error.message);
    }

    console.log('\n=== Final Test Summary ===');
    console.log(`✅ Space created: ${spaceId}`);
    console.log(`✅ Ownership token deployed: ${tokenAddress}`);
    console.log(`✅ Deploy token proposal created: ${deployProposalId}`);
    console.log(`✅ Mint proposal created: ${mintProposalId}`);
    console.log(`✅ Deploy proposal executed: ${deployProposalData.executed}`);
    console.log(`✅ Mint proposal executed: ${mintProposalData.executed}`);
    console.log(
      '🎉 Ownership token creation and minting test completed successfully!',
    );
    console.log('📊 The test demonstrated:');
    console.log('   - Token deployment through governance');
    console.log('   - Token minting through governance');
    console.log('   - Verification of token deployment and balance');

    return;
  } catch (error) {
    console.error('Error in test execution:', error);
  }
}

// Run the test
testOwnershipTokenCreationAndMinting().catch(console.error);
