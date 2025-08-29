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

interface GasCostAnalysis {
  operation: string;
  gasUsed: bigint;
  gasPrice: bigint;
  ethCost: string;
  usdCost: string;
  txHash: string;
}

// ETH price in USD
const ETH_PRICE_USD = 4600;

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
    name: 'joinSpace',
    outputs: [],
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
    name: 'executeProposal',
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
];

// ERC20 Token ABI for USDC transfer
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
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
];

function calculateUSDCost(gasUsed: bigint, gasPrice: bigint): string {
  const ethCost = ethers.formatEther(gasUsed * gasPrice);
  const usdCost = parseFloat(ethCost) * ETH_PRICE_USD;
  return usdCost.toFixed(6);
}

function formatETHCost(gasUsed: bigint, gasPrice: bigint): string {
  return ethers.formatEther(gasUsed * gasPrice);
}

async function analyzeTransactionCosts(): Promise<void> {
  console.log('Starting gas cost analysis...');
  console.log(`ETH Price: $${ETH_PRICE_USD} USD\n`);

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

  // Create a different wallet for joining space (generate a new one if only one account)
  let wallet2: ethers.Wallet;
  if (accountData.length > 1) {
    wallet2 = new ethers.Wallet(accountData[1].privateKey, provider);
  } else {
    // Generate a new random wallet for testing join functionality
    const randomWallet = ethers.Wallet.createRandom();
    wallet2 = new ethers.Wallet(randomWallet.privateKey, provider);
    console.log('Generated new wallet for join testing:', wallet2.address);
    console.log(
      '🔑 PRIVATE KEY (save this to recover funds):',
      randomWallet.privateKey,
    );

    // Send some ETH to the new wallet for gas
    try {
      // Check main wallet balance first
      const mainBalance = await provider.getBalance(wallet.address);
      console.log(
        `Main wallet balance: ${ethers.formatEther(mainBalance)} ETH`,
      );

      // Send a very small amount - just enough for gas fees
      const sendAmount = ethers.parseEther('0.000001'); // Send 0.000001 ETH (about $0.0046) for gas

      if (mainBalance > sendAmount) {
        const sendEthTx = await wallet.sendTransaction({
          to: wallet2.address,
          value: sendAmount,
        });
        await sendEthTx.wait();
        console.log(
          `Sent ${ethers.formatEther(
            sendAmount,
          )} ETH to new wallet for gas fees`,
        );
      } else {
        console.log('❌ Insufficient ETH in main wallet to fund test wallet');
        console.log('Using main wallet for all tests instead');
        wallet2 = wallet; // Use same wallet if insufficient funds
      }
    } catch (error) {
      console.log('Failed to send ETH to test wallet:', error.message);
      console.log('Using main wallet for all tests instead');
      wallet2 = wallet; // Use same wallet if transfer fails
    }
  }

  console.log(`Primary wallet address: ${wallet.address}`);
  console.log(`Secondary wallet address: ${wallet2.address}`);

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

  const ownershipTokenFactoryAddress =
    process.env.OWNERSHIP_TOKEN_FACTORY_ADDRESS ||
    '0xA1eDf096B72226ae2f7BDEb12E9c9C82152BccB6';

  const gasCosts: GasCostAnalysis[] = [];

  try {
    // 1. Space Creation
    console.log('=== 1. Analyzing Space Creation Gas Cost ===');
    const spaceParams: SpaceCreationParams = {
      unity: 51,
      quorum: 51,
      votingPowerSource: 2,
      exitMethod: 2,
      joinMethod: 1,
    };

    const createSpaceTx = await daoSpaceFactory.createSpace(spaceParams);
    const spaceReceipt = await createSpaceTx.wait();

    const spaceGasCost: GasCostAnalysis = {
      operation: 'Space Creation',
      gasUsed: spaceReceipt.gasUsed,
      gasPrice: spaceReceipt.gasPrice || createSpaceTx.gasPrice || 0n,
      ethCost: formatETHCost(
        spaceReceipt.gasUsed,
        spaceReceipt.gasPrice || createSpaceTx.gasPrice || 0n,
      ),
      usdCost: calculateUSDCost(
        spaceReceipt.gasUsed,
        spaceReceipt.gasPrice || createSpaceTx.gasPrice || 0n,
      ),
      txHash: createSpaceTx.hash,
    };
    gasCosts.push(spaceGasCost);

    // Get space ID from event
    const spaceEvent = spaceReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'SpaceCreated(uint256,uint256,uint256,uint256,uint256,uint256,address,address)',
        ),
    );
    const spaceId = spaceEvent ? parseInt(spaceEvent.topics[1], 16) : 1;

    console.log(`Space created with ID: ${spaceId}`);
    console.log(`Gas used: ${spaceGasCost.gasUsed}`);
    console.log(`ETH cost: ${spaceGasCost.ethCost} ETH`);
    console.log(`USD cost: $${spaceGasCost.usdCost}`);

    // 2. First Proposal Creation (Token Deployment)
    console.log(
      '\n=== 2. Analyzing First Proposal Creation (Token Deployment) ===',
    );

    const tokenParams = {
      spaceId: spaceId,
      name: 'Test Ownership Token',
      symbol: 'TOT',
      maxSupply: ethers.parseUnits('1000000', 18),
      isVotingToken: false,
    };

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
      duration: 60, // 1 minute for faster testing
      transactions: [
        {
          target: ownershipTokenFactoryAddress,
          value: 0,
          data: encodedDeployTokenData,
        },
      ],
    };

    const createDeployProposalTx = await daoProposals.createProposal(
      deployTokenProposalParams,
      { gasLimit: 3000000 },
    );
    const deployProposalReceipt = await createDeployProposalTx.wait();

    const deployProposalGasCost: GasCostAnalysis = {
      operation: 'Proposal Creation (Token Deployment)',
      gasUsed: deployProposalReceipt.gasUsed,
      gasPrice:
        deployProposalReceipt.gasPrice || createDeployProposalTx.gasPrice || 0n,
      ethCost: formatETHCost(
        deployProposalReceipt.gasUsed,
        deployProposalReceipt.gasPrice || createDeployProposalTx.gasPrice || 0n,
      ),
      usdCost: calculateUSDCost(
        deployProposalReceipt.gasUsed,
        deployProposalReceipt.gasPrice || createDeployProposalTx.gasPrice || 0n,
      ),
      txHash: createDeployProposalTx.hash,
    };
    gasCosts.push(deployProposalGasCost);

    // Get proposal ID
    const deployProposalEvent = deployProposalReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'ProposalCreated(uint256,uint256,uint256,uint256,address,bytes)',
        ),
    );
    const deployProposalId = deployProposalEvent
      ? parseInt(deployProposalEvent.topics[1], 16)
      : 1;

    console.log(`Deploy proposal created with ID: ${deployProposalId}`);
    console.log(`Gas used: ${deployProposalGasCost.gasUsed}`);
    console.log(`ETH cost: ${deployProposalGasCost.ethCost} ETH`);
    console.log(`USD cost: $${deployProposalGasCost.usdCost}`);

    // 3. Second Proposal Creation (Token Minting) - smaller transaction
    console.log(
      '\n=== 3. Analyzing Second Proposal Creation (Token Minting) ===',
    );

    // Create a simple mint proposal (smaller than token deployment)
    const mintAmount = ethers.parseUnits('1000', 18);
    const mintTo = wallet.address;

    const mintData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256'],
      [mintTo, mintAmount],
    );

    const mintMethod = 'mint(address,uint256)';
    const mintFunctionSelector = ethers.id(mintMethod).substring(0, 10);
    const encodedMintData = mintFunctionSelector + mintData.substring(2);

    // Dummy token address for proposal creation
    const dummyTokenAddress = '0x1234567890123456789012345678901234567890';

    const mintProposalParams: ProposalParams = {
      spaceId: spaceId,
      duration: 60, // 1 minute for faster testing
      transactions: [
        {
          target: dummyTokenAddress,
          value: 0,
          data: encodedMintData,
        },
      ],
    };

    const createMintProposalTx = await daoProposals.createProposal(
      mintProposalParams,
      { gasLimit: 3000000 },
    );
    const mintProposalReceipt = await createMintProposalTx.wait();

    const mintProposalGasCost: GasCostAnalysis = {
      operation: 'Proposal Creation (Token Minting)',
      gasUsed: mintProposalReceipt.gasUsed,
      gasPrice:
        mintProposalReceipt.gasPrice || createMintProposalTx.gasPrice || 0n,
      ethCost: formatETHCost(
        mintProposalReceipt.gasUsed,
        mintProposalReceipt.gasPrice || createMintProposalTx.gasPrice || 0n,
      ),
      usdCost: calculateUSDCost(
        mintProposalReceipt.gasUsed,
        mintProposalReceipt.gasPrice || createMintProposalTx.gasPrice || 0n,
      ),
      txHash: createMintProposalTx.hash,
    };
    gasCosts.push(mintProposalGasCost);

    const mintProposalEvent = mintProposalReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'ProposalCreated(uint256,uint256,uint256,uint256,address,bytes)',
        ),
    );
    const mintProposalId = mintProposalEvent
      ? parseInt(mintProposalEvent.topics[1], 16)
      : 2;

    console.log(`Mint proposal created with ID: ${mintProposalId}`);
    console.log(`Gas used: ${mintProposalGasCost.gasUsed}`);
    console.log(`ETH cost: ${mintProposalGasCost.ethCost} ETH`);
    console.log(`USD cost: $${mintProposalGasCost.usdCost}`);

    // Vote on mint proposal immediately to prevent expiration
    console.log('Voting on mint proposal immediately...');
    const mintVoteTxEarly = await daoProposals.vote(mintProposalId, true);
    const mintVoteReceipt = await mintVoteTxEarly.wait();
    console.log('Early vote cast successfully on mint proposal');

    // Track voting gas cost for mint proposal
    const mintVoteGasCost: GasCostAnalysis = {
      operation: 'Voting on Proposal (Token Minting)',
      gasUsed: mintVoteReceipt.gasUsed,
      gasPrice: mintVoteReceipt.gasPrice || mintVoteTxEarly.gasPrice || 0n,
      ethCost: formatETHCost(
        mintVoteReceipt.gasUsed,
        mintVoteReceipt.gasPrice || mintVoteTxEarly.gasPrice || 0n,
      ),
      usdCost: calculateUSDCost(
        mintVoteReceipt.gasUsed,
        mintVoteReceipt.gasPrice || mintVoteTxEarly.gasPrice || 0n,
      ),
      txHash: mintVoteTxEarly.hash,
    };
    gasCosts.push(mintVoteGasCost);

    console.log(`Voting gas used: ${mintVoteGasCost.gasUsed}`);
    console.log(`Voting ETH cost: ${mintVoteGasCost.ethCost} ETH`);
    console.log(`Voting USD cost: $${mintVoteGasCost.usdCost}`);

    // 4. First Proposal Voting (Token Deployment)
    console.log('\n=== 4. Analyzing Voting on Proposal (Token Deployment) ===');

    // Vote on the deploy proposal first
    console.log('Voting on deploy proposal...');
    const deployVoteTx = await daoProposals.vote(deployProposalId, true);
    const deployVoteReceipt = await deployVoteTx.wait();
    console.log('Vote cast successfully');

    // Track voting gas cost
    const deployVoteGasCost: GasCostAnalysis = {
      operation: 'Voting on Proposal (Token Deployment)',
      gasUsed: deployVoteReceipt.gasUsed,
      gasPrice: deployVoteReceipt.gasPrice || deployVoteTx.gasPrice || 0n,
      ethCost: formatETHCost(
        deployVoteReceipt.gasUsed,
        deployVoteReceipt.gasPrice || deployVoteTx.gasPrice || 0n,
      ),
      usdCost: calculateUSDCost(
        deployVoteReceipt.gasUsed,
        deployVoteReceipt.gasPrice || deployVoteTx.gasPrice || 0n,
      ),
      txHash: deployVoteTx.hash,
    };
    gasCosts.push(deployVoteGasCost);

    console.log(`Voting gas used: ${deployVoteGasCost.gasUsed}`);
    console.log(`Voting ETH cost: ${deployVoteGasCost.ethCost} ETH`);
    console.log(`Voting USD cost: $${deployVoteGasCost.usdCost}`);

    // Check proposal status immediately after voting (execution happens automatically)
    let deployProposalData = await daoProposals.getProposalCore(
      deployProposalId,
    );
    console.log('Proposal status after voting:');
    console.log(`- Yes votes: ${deployProposalData.yesVotes}`);
    console.log(`- No votes: ${deployProposalData.noVotes}`);
    console.log(
      `- Total voting power: ${deployProposalData.totalVotingPowerAtSnapshot}`,
    );
    console.log(`- Executed: ${deployProposalData.executed}`);
    console.log(`- Expired: ${deployProposalData.expired}`);

    if (deployProposalData.executed) {
      console.log(
        '✅ Deploy proposal was automatically executed during voting!',
      );
      console.log(
        'Note: Execution gas cost is included in the voting transaction above.',
      );
    } else {
      console.log('⏳ Deploy proposal not executed yet or failed');
      console.log('Adding estimated execution cost for analysis');
      // Add estimated gas cost based on typical execution
      const estimatedGasCost: GasCostAnalysis = {
        operation: 'Proposal Execution (Token Deployment) - Estimated',
        gasUsed: 800000n, // Estimated based on typical deployment execution
        gasPrice: await provider
          .getFeeData()
          .then((fee) => fee.gasPrice || 20000000000n),
        ethCost: 'N/A (Estimated)',
        usdCost: 'N/A (Estimated)',
        txHash: 'N/A (Failed/Not Ready)',
      };
      estimatedGasCost.ethCost = formatETHCost(
        estimatedGasCost.gasUsed,
        estimatedGasCost.gasPrice,
      );
      estimatedGasCost.usdCost = calculateUSDCost(
        estimatedGasCost.gasUsed,
        estimatedGasCost.gasPrice,
      );
      gasCosts.push(estimatedGasCost);
    }

    // 5. Second Proposal Status Check (Token Minting)
    console.log('\n=== 5. Checking Mint Proposal Status ===');

    // We already voted on the mint proposal above, so skip voting
    console.log('Mint proposal already voted on, proceeding to execution...');

    // Check proposal status immediately after voting (execution happens automatically)
    let mintProposalData = await daoProposals.getProposalCore(mintProposalId);
    console.log('Mint proposal status after voting:');
    console.log(`- Yes votes: ${mintProposalData.yesVotes}`);
    console.log(`- No votes: ${mintProposalData.noVotes}`);
    console.log(
      `- Total voting power: ${mintProposalData.totalVotingPowerAtSnapshot}`,
    );
    console.log(`- Executed: ${mintProposalData.executed}`);
    console.log(`- Expired: ${mintProposalData.expired}`);

    // Check if mint proposal was auto-executed
    if (mintProposalData.executed) {
      console.log('✅ Mint proposal was automatically executed during voting!');
      console.log(
        'Note: Execution gas cost is included in the voting transaction above.',
      );
    } else {
      console.log('⏳ Mint proposal not executed yet or failed');
      console.log('Adding estimated execution cost for analysis');
      // Add estimated gas cost
      const estimatedGasCost: GasCostAnalysis = {
        operation: 'Proposal Execution (Token Minting) - Estimated',
        gasUsed: 200000n, // Estimated based on typical mint execution
        gasPrice: await provider
          .getFeeData()
          .then((fee) => fee.gasPrice || 20000000000n),
        ethCost: 'N/A (Estimated)',
        usdCost: 'N/A (Estimated)',
        txHash: 'N/A (Failed/Not Ready)',
      };
      estimatedGasCost.ethCost = formatETHCost(
        estimatedGasCost.gasUsed,
        estimatedGasCost.gasPrice,
      );
      estimatedGasCost.usdCost = calculateUSDCost(
        estimatedGasCost.gasUsed,
        estimatedGasCost.gasPrice,
      );
      gasCosts.push(estimatedGasCost);
    }

    // 6. Joining Space
    console.log('\n=== 6. Analyzing Space Joining Gas Cost ===');

    try {
      // Check if we're using different wallets
      if (wallet.address === wallet2.address) {
        console.log(
          '⚠️  Using same wallet for join test - will provide estimated cost',
        );
        throw new Error('Cannot join space with same wallet that created it');
      }

      const joinSpaceTx = await (
        daoSpaceFactory.connect(wallet2) as any
      ).joinSpace(spaceId);
      const joinSpaceReceipt = await joinSpaceTx.wait();

      const joinSpaceGasCost: GasCostAnalysis = {
        operation: 'Joining Space',
        gasUsed: joinSpaceReceipt.gasUsed,
        gasPrice: joinSpaceReceipt.gasPrice || joinSpaceTx.gasPrice || 0n,
        ethCost: formatETHCost(
          joinSpaceReceipt.gasUsed,
          joinSpaceReceipt.gasPrice || joinSpaceTx.gasPrice || 0n,
        ),
        usdCost: calculateUSDCost(
          joinSpaceReceipt.gasUsed,
          joinSpaceReceipt.gasPrice || joinSpaceTx.gasPrice || 0n,
        ),
        txHash: joinSpaceTx.hash,
      };
      gasCosts.push(joinSpaceGasCost);

      console.log(`Space joined successfully`);
      console.log(`Gas used: ${joinSpaceGasCost.gasUsed}`);
      console.log(`ETH cost: ${joinSpaceGasCost.ethCost} ETH`);
      console.log(`USD cost: $${joinSpaceGasCost.usdCost}`);
    } catch (error) {
      console.log('Space joining failed or not allowed:', error.message);
      // Add estimated gas cost
      const estimatedGasCost: GasCostAnalysis = {
        operation: 'Joining Space - Estimated',
        gasUsed: 100000n, // Estimated based on typical join operation
        gasPrice: await provider
          .getFeeData()
          .then((fee) => fee.gasPrice || 20000000000n),
        ethCost: 'N/A (Estimated)',
        usdCost: 'N/A (Estimated)',
        txHash: 'N/A (Failed)',
      };
      estimatedGasCost.ethCost = formatETHCost(
        estimatedGasCost.gasUsed,
        estimatedGasCost.gasPrice,
      );
      estimatedGasCost.usdCost = calculateUSDCost(
        estimatedGasCost.gasUsed,
        estimatedGasCost.gasPrice,
      );
      gasCosts.push(estimatedGasCost);
    }

    // 7. USDC Token Transfer
    console.log('\n=== 7. Analyzing USDC Token Transfer Gas Cost ===');

    // Base mainnet USDC contract address
    const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base
    const usdcContract = new ethers.Contract(usdcAddress, erc20Abi, wallet);

    try {
      // Check wallet USDC balance first
      const usdcBalance = await usdcContract.balanceOf(wallet.address);
      console.log(
        `Current USDC balance: ${ethers.formatUnits(usdcBalance, 6)} USDC`,
      );

      // Transfer amount: 0.0001 USDC (100 units with 6 decimals)
      const transferAmount = 100; // 0.0001 USDC in units

      if (usdcBalance >= transferAmount) {
        console.log('Transferring 0.0001 USDC...');
        const transferTx = await usdcContract.transfer(
          wallet2.address,
          transferAmount,
        );
        const transferReceipt = await transferTx.wait();

        const usdcTransferGasCost: GasCostAnalysis = {
          operation: 'USDC Token Transfer (0.0001 USDC)',
          gasUsed: transferReceipt.gasUsed,
          gasPrice: transferReceipt.gasPrice || transferTx.gasPrice || 0n,
          ethCost: formatETHCost(
            transferReceipt.gasUsed,
            transferReceipt.gasPrice || transferTx.gasPrice || 0n,
          ),
          usdCost: calculateUSDCost(
            transferReceipt.gasUsed,
            transferReceipt.gasPrice || transferTx.gasPrice || 0n,
          ),
          txHash: transferTx.hash,
        };
        gasCosts.push(usdcTransferGasCost);

        console.log(`USDC transfer completed successfully`);
        console.log(`Gas used: ${usdcTransferGasCost.gasUsed}`);
        console.log(`ETH cost: ${usdcTransferGasCost.ethCost} ETH`);
        console.log(`USD cost: $${usdcTransferGasCost.usdCost}`);
      } else {
        console.log('❌ Insufficient USDC balance for transfer');
        console.log('Adding estimated USDC transfer cost for analysis');

        // Use estimated gas cost for USDC transfer
        const estimatedUSDCGasCost: GasCostAnalysis = {
          operation: 'USDC Token Transfer (0.0001 USDC) - Estimated',
          gasUsed: 65000n, // Typical gas for ERC20 transfer
          gasPrice: await provider
            .getFeeData()
            .then((fee) => fee.gasPrice || 2000000000n),
          ethCost: 'N/A (Estimated)',
          usdCost: 'N/A (Estimated)',
          txHash: 'N/A (Insufficient Balance)',
        };
        estimatedUSDCGasCost.ethCost = formatETHCost(
          estimatedUSDCGasCost.gasUsed,
          estimatedUSDCGasCost.gasPrice,
        );
        estimatedUSDCGasCost.usdCost = calculateUSDCost(
          estimatedUSDCGasCost.gasUsed,
          estimatedUSDCGasCost.gasPrice,
        );
        gasCosts.push(estimatedUSDCGasCost);

        console.log(`Estimated gas: ${estimatedUSDCGasCost.gasUsed}`);
        console.log(`ETH cost: ${estimatedUSDCGasCost.ethCost} ETH`);
        console.log(`USD cost: $${estimatedUSDCGasCost.usdCost}`);
      }
    } catch (error) {
      console.log('USDC transfer failed or not available:', error.message);

      // Add estimated gas cost
      const estimatedUSDCGasCost: GasCostAnalysis = {
        operation: 'USDC Token Transfer (0.0001 USDC) - Estimated',
        gasUsed: 65000n, // Typical gas for ERC20 transfer
        gasPrice: await provider
          .getFeeData()
          .then((fee) => fee.gasPrice || 2000000000n),
        ethCost: 'N/A (Estimated)',
        usdCost: 'N/A (Estimated)',
        txHash: 'N/A (Failed)',
      };
      estimatedUSDCGasCost.ethCost = formatETHCost(
        estimatedUSDCGasCost.gasUsed,
        estimatedUSDCGasCost.gasPrice,
      );
      estimatedUSDCGasCost.usdCost = calculateUSDCost(
        estimatedUSDCGasCost.gasUsed,
        estimatedUSDCGasCost.gasPrice,
      );
      gasCosts.push(estimatedUSDCGasCost);

      console.log(`Estimated gas: ${estimatedUSDCGasCost.gasUsed}`);
      console.log(`ETH cost: ${estimatedUSDCGasCost.ethCost} ETH`);
      console.log(`USD cost: $${estimatedUSDCGasCost.usdCost}`);
    }

    // Summary Report
    console.log('\n' + '='.repeat(80));
    console.log('GAS COST ANALYSIS SUMMARY');
    console.log('='.repeat(80));
    console.log(`ETH Price: $${ETH_PRICE_USD} USD`);
    console.log('');

    let totalETHCost = 0;
    let totalUSDCost = 0;

    gasCosts.forEach((cost, index) => {
      console.log(`${index + 1}. ${cost.operation}`);
      console.log(`   Gas Used: ${cost.gasUsed.toLocaleString()}`);
      console.log(`   Gas Price: ${cost.gasPrice.toLocaleString()} wei`);
      console.log(`   ETH Cost: ${cost.ethCost} ETH`);
      console.log(`   USD Cost: $${cost.usdCost} USD`);
      console.log(`   TX Hash: ${cost.txHash}`);
      console.log('');

      if (!cost.ethCost.includes('N/A') && !cost.usdCost.includes('N/A')) {
        totalETHCost += parseFloat(cost.ethCost);
        totalUSDCost += parseFloat(cost.usdCost);
      }
    });

    console.log('='.repeat(80));
    console.log('TOTAL COSTS (excluding estimates)');
    console.log(`Total ETH Cost: ${totalETHCost.toFixed(8)} ETH`);
    console.log(`Total USD Cost: $${totalUSDCost.toFixed(2)} USD`);
    console.log('='.repeat(80));

    // Save results to file (convert BigInt values to strings for JSON serialization)
    const serializableGasCosts = gasCosts.map((cost) => ({
      ...cost,
      gasUsed: cost.gasUsed.toString(),
      gasPrice: cost.gasPrice.toString(),
    }));

    const results = {
      timestamp: new Date().toISOString(),
      ethPrice: ETH_PRICE_USD,
      gasCosts: serializableGasCosts,
      totals: {
        ethCost: totalETHCost.toFixed(8),
        usdCost: totalUSDCost.toFixed(2),
      },
    };

    fs.writeFileSync(
      'gas-cost-analysis-results.json',
      JSON.stringify(results, null, 2),
    );
    console.log('\nResults saved to gas-cost-analysis-results.json');

    // Show wallet recovery information
    if (wallet.address !== wallet2.address) {
      console.log('\n' + '='.repeat(80));
      console.log('WALLET RECOVERY INFORMATION');
      console.log('='.repeat(80));
      console.log(`Test wallet address: ${wallet2.address}`);
      console.log(`Test wallet private key: ${(wallet2 as any).privateKey}`);
      console.log(
        '💡 Use this private key to recover any remaining ETH in the test wallet',
      );
      console.log('='.repeat(80));
    }
  } catch (error) {
    console.error('Error in gas cost analysis:', error);
  }
}

// Run the analysis
analyzeTransactionCosts().catch(console.error);
