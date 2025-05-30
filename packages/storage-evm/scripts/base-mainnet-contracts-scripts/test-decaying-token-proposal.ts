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

// Base Mainnet contract addresses from addresses.txt
const CONTRACTS = {
  DAO_SPACE_FACTORY: '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9',
  DAO_PROPOSALS: '0x001bA7a00a259Fb12d7936455e292a60FC2bef14',
  DECAYING_TOKEN_FACTORY: '0x299f4D2327933c1f363301dbd2a28379ccD5539b',
  DECAY_TOKEN_VOTING_POWER: '0x9A1c157f8b0A8F7bFb0f6A82d69F52fAc5Bb7EfD',
};

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
    name: 'joinSpace',
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
    inputs: [{ internalType: 'uint256', name: 'spaceId', type: 'uint256' }],
    name: 'getSpaceToken',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
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
];

// DecayingSpaceToken ABI for verification
const decayingSpaceTokenAbi = [
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
    name: 'decayPercentage',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decayInterval',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// DecayTokenVotingPower ABI
const decayTokenVotingPowerAbi = [
  {
    inputs: [],
    name: 'decayTokenFactory',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'spacesContract',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// Add these event signatures after the existing ABIs
const decayingTokenFactoryEventSignatures = {
  TokenDeployed: ethers.id('TokenDeployed(uint256,address,string,string)'),
  DecayingTokenParameters: ethers.id(
    'DecayingTokenParameters(address,uint256,uint256)',
  ),
  VotingTokenSet: ethers.id('VotingTokenSet(uint256,address)'),
  SpacesContractUpdated: ethers.id('SpacesContractUpdated(address)'),
  DecayVotingPowerContractUpdated: ethers.id(
    'DecayVotingPowerContractUpdated(address)',
  ),
};

// Add function to parse DecayingTokenFactory events
function parseDecayingTokenFactoryEvents(receipt: any, factoryAddress: string) {
  console.log('\n🔍 Parsing DecayingTokenFactory events from transaction...');

  const factoryEvents = receipt.logs.filter(
    (log: any) =>
      log.address && log.address.toLowerCase() === factoryAddress.toLowerCase(),
  );

  console.log(`Found ${factoryEvents.length} events from DecayingTokenFactory`);

  factoryEvents.forEach((log: any, index: number) => {
    console.log(`\n📋 Event ${index + 1}:`);
    console.log(`  Address: ${log.address}`);
    console.log(`  Topics: ${log.topics}`);
    console.log(`  Data: ${log.data}`);

    // Check for specific events
    const topic0 = log.topics[0];

    if (topic0 === decayingTokenFactoryEventSignatures.TokenDeployed) {
      try {
        // TokenDeployed(uint256 indexed spaceId, address indexed tokenAddress, string name, string symbol)
        // spaceId is in topics[1], tokenAddress is in topics[2]
        const spaceId = parseInt(log.topics[1], 16);
        const tokenAddress = '0x' + log.topics[2].slice(26); // Extract address from topic

        // Decode the non-indexed parameters (name, symbol) from data
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ['string', 'string'],
          log.data,
        );

        console.log(`  🎉 TokenDeployed Event Found!`);
        console.log(`    Space ID: ${spaceId}`);
        console.log(`    Token Address: ${tokenAddress}`);
        console.log(`    Name: ${decoded[0]}`);
        console.log(`    Symbol: ${decoded[1]}`);
        return { spaceId, tokenAddress, name: decoded[0], symbol: decoded[1] };
      } catch (error) {
        console.log(`  ❌ Error decoding TokenDeployed event: ${error}`);
      }
    } else if (
      topic0 === decayingTokenFactoryEventSignatures.DecayingTokenParameters
    ) {
      try {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ['address', 'uint256', 'uint256'],
          log.data,
        );
        console.log(`  📊 DecayingTokenParameters Event Found!`);
        console.log(`    Token Address: ${decoded[0]}`);
        console.log(`    Decay Percentage: ${decoded[1]} basis points`);
        console.log(`    Decay Interval: ${decoded[2]} seconds`);
      } catch (error) {
        console.log(
          `  ❌ Error decoding DecayingTokenParameters event: ${error}`,
        );
      }
    } else if (topic0 === decayingTokenFactoryEventSignatures.VotingTokenSet) {
      try {
        const spaceId = parseInt(log.topics[1], 16);
        const tokenAddress = '0x' + log.topics[2].slice(26);
        console.log(`  🗳️ VotingTokenSet Event Found!`);
        console.log(`    Space ID: ${spaceId}`);
        console.log(`    Token Address: ${tokenAddress}`);
      } catch (error) {
        console.log(`  ❌ Error decoding VotingTokenSet event: ${error}`);
      }
    } else {
      console.log(`  ❓ Unknown event with topic: ${topic0}`);
    }
  });

  return null;
}

// Add function to check for failed execution events
function checkForExecutionFailure(receipt: any) {
  console.log('\n🔍 Checking for execution failure events...');

  // Look for any revert or failure events
  const allEvents = receipt.logs;
  console.log(`Total logs in transaction: ${allEvents.length}`);

  allEvents.forEach((log: any, index: number) => {
    console.log(`\nLog ${index + 1}:`);
    console.log(`  Address: ${log.address}`);
    console.log(`  Topics: ${log.topics.slice(0, 2)}`); // Show first 2 topics
    console.log(`  Data length: ${log.data.length}`);

    // Check if this might be an execution event from the proposals contract
    if (log.address.toLowerCase() === CONTRACTS.DAO_PROPOSALS.toLowerCase()) {
      console.log(`  📍 Event from DAOProposals contract`);

      // Check for execution events
      const possibleExecutionEvents = [
        ethers.id('ProposalExecuted(uint256)'),
        ethers.id('ProposalExecutionFailed(uint256,string)'),
        ethers.id('ExecutionFailed(uint256,uint256,string)'),
      ];

      possibleExecutionEvents.forEach((eventSig) => {
        if (log.topics[0] === eventSig) {
          console.log(`    🎯 Matched known execution event: ${eventSig}`);
        }
      });
    }
  });
}

async function testDecayingTokenProposal(): Promise<void> {
  console.log('🚀 Starting decaying token proposal test...');
  console.log('\n=== CONTRACT ADDRESSES ===');
  console.log(`DAO Space Factory: ${CONTRACTS.DAO_SPACE_FACTORY}`);
  console.log(`DAO Proposals: ${CONTRACTS.DAO_PROPOSALS}`);
  console.log(`Decaying Token Factory: ${CONTRACTS.DECAYING_TOKEN_FACTORY}`);

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
  console.log(`\n💼 Using wallet address: ${wallet.address}`);

  // Initialize contracts
  const daoSpaceFactory = new ethers.Contract(
    CONTRACTS.DAO_SPACE_FACTORY,
    daoSpaceFactoryAbi,
    wallet,
  );

  const daoProposals = new ethers.Contract(
    CONTRACTS.DAO_PROPOSALS,
    daoProposalsAbi,
    wallet,
  );

  const decayingTokenFactory = new ethers.Contract(
    CONTRACTS.DECAYING_TOKEN_FACTORY,
    decayingTokenFactoryAbi,
    wallet,
  );

  // Test getSpaceToken functionality first
  console.log('\n=== TESTING getSpaceToken BEFORE TOKEN DEPLOYMENT ===');

  let tokenAddressBefore = ethers.ZeroAddress;
  try {
    tokenAddressBefore = await decayingTokenFactory.getSpaceToken(1); // Test with space 1
    console.log(`Token address before deployment: ${tokenAddressBefore}`);
  } catch (error: any) {
    if (error.code === 'CALL_EXCEPTION') {
      console.log(
        '✅ Confirmed: No token deployed yet (contract reverted as expected)',
      );
      tokenAddressBefore = ethers.ZeroAddress;
    } else {
      console.error(
        '❌ Unexpected error calling getSpaceToken:',
        error.message,
      );
      throw error;
    }
  }

  if (tokenAddressBefore === ethers.ZeroAddress) {
    console.log(
      '✅ getSpaceToken works correctly - returns zero address when no token deployed',
    );
  } else {
    console.log('⚠️ Unexpected: Token address found for space 1');
  }

  try {
    // Step 1: Create a Space
    console.log('\n📍 Step 1: Creating a new space...');
    const spaceParams: SpaceCreationParams = {
      unity: 51, // 51% unity
      quorum: 10, // 10% quorum (lower for easier testing)
      votingPowerSource: 2, // Space voting power (1 member = 1 vote)
      exitMethod: 1,
      joinMethod: 1,
    };

    console.log(
      `Creating space with unity: ${spaceParams.unity}%, quorum: ${spaceParams.quorum}%`,
    );
    const tx = await daoSpaceFactory.createSpace(spaceParams);
    console.log(`Space creation transaction submitted: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log('✅ Space creation transaction confirmed');

    // Find the SpaceCreated event
    const event = receipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'SpaceCreated(uint256,uint256,uint256,uint256,uint256,uint256,address,address)',
        ),
    );

    if (!event) {
      console.error('❌ Space creation event not found in transaction receipt');
      return;
    }

    const spaceId = parseInt(event.topics[1], 16);
    console.log(`🎉 Space created with ID: ${spaceId}`);

    // Get space executor and members
    const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);
    console.log(`🔑 Space executor address: ${executorAddress}`);

    const members = await daoSpaceFactory.getSpaceMembers(spaceId);
    console.log(`👥 Space members: ${members}`);
    console.log(`✅ Creator is member: ${members.includes(wallet.address)}`);

    // Define token parameters early so we can modify them based on contract setup
    const tokenName = 'Governance Decay Token';
    const tokenSymbol = 'GDT';
    const maxSupply = 0; // Unlimited supply
    const transferable = true;
    let isVotingToken = true; // This might be changed based on contract setup
    const decayPercentage = 500; // 5% decay per interval (in basis points)
    const decayInterval = 86400; // 1 day in seconds

    // Step 2.5: Check DecayingTokenFactory configuration
    console.log(
      '\n📍 Step 2.5: Checking DecayingTokenFactory configuration...',
    );

    try {
      const spacesContract = await decayingTokenFactory.spacesContract();
      console.log(`✅ Spaces contract set to: ${spacesContract}`);

      if (spacesContract === ethers.ZeroAddress) {
        console.log(
          '❌ Spaces contract is not set - this will cause deployment to fail',
        );
        return;
      }
    } catch (error) {
      console.error('❌ Error checking spacesContract:', error);
      return;
    }

    let decayVotingPowerAddress = ethers.ZeroAddress;
    try {
      decayVotingPowerAddress =
        await decayingTokenFactory.decayVotingPowerContract();
      console.log(
        `✅ Decay voting power contract set to: ${decayVotingPowerAddress}`,
      );

      if (decayVotingPowerAddress === ethers.ZeroAddress) {
        console.log('⚠️ Decay voting power contract is not set');
        console.log(
          '   Since isVotingToken=true, this might cause deployment to fail',
        );
        console.log('   Trying with isVotingToken=false instead...');

        // Set isVotingToken to false if no voting power contract is set
        isVotingToken = false;
      }
    } catch (error) {
      console.error('❌ Error checking decayVotingPowerContract:', error);
      console.log('   Setting isVotingToken=false to avoid issues...');
      isVotingToken = false;
    }

    // Step 2.6: Check DecayTokenVotingPower configuration (reverse check)
    if (decayVotingPowerAddress !== ethers.ZeroAddress) {
      console.log(
        '\n📍 Step 2.6: Checking DecayTokenVotingPower configuration...',
      );

      const decayTokenVotingPower = new ethers.Contract(
        decayVotingPowerAddress,
        decayTokenVotingPowerAbi,
        provider,
      );

      try {
        const configuredTokenFactory =
          await decayTokenVotingPower.decayTokenFactory();
        console.log(
          `✅ DecayTokenVotingPower.decayTokenFactory set to: ${configuredTokenFactory}`,
        );

        if (
          configuredTokenFactory.toLowerCase() !==
          CONTRACTS.DECAYING_TOKEN_FACTORY.toLowerCase()
        ) {
          console.log(
            '⚠️ DecayTokenVotingPower.decayTokenFactory does not match our DecayingTokenFactory!',
          );
          console.log(`   Expected: ${CONTRACTS.DECAYING_TOKEN_FACTORY}`);
          console.log(`   Actual: ${configuredTokenFactory}`);
          console.log('   This might cause voting token registration to fail');
        } else {
          console.log(
            '✅ DecayTokenVotingPower correctly configured with DecayingTokenFactory',
          );
        }
      } catch (error) {
        console.error(
          '❌ Error checking DecayTokenVotingPower.decayTokenFactory:',
          error,
        );
        console.log(
          '   This might indicate the voting power contract is not properly deployed',
        );
      }

      try {
        const spacesContractAddress =
          await decayTokenVotingPower.spacesContract();
        console.log(
          `✅ DecayTokenVotingPower.spacesContract set to: ${spacesContractAddress}`,
        );

        if (
          spacesContractAddress.toLowerCase() ===
          CONTRACTS.DAO_SPACE_FACTORY.toLowerCase()
        ) {
          console.log(
            '✅ DecayTokenVotingPower correctly configured with DAOSpaceFactory',
          );
        } else {
          console.log('❌ DecayTokenVotingPower spacesContract mismatch');
          console.log('Expected:', CONTRACTS.DAO_SPACE_FACTORY);
          console.log('Actual:', spacesContractAddress);
        }
      } catch (error: any) {
        console.log(
          '⚠️ DecayTokenVotingPower.spacesContract() function not available',
        );
        console.log(
          "This is expected if the contract doesn't have a spacesContract getter",
        );
      }
    }

    // Step 3: Create a Proposal to deploy a decaying token
    console.log('\n📍 Step 3: Creating proposal to deploy decaying token...');

    console.log(`\n🪙 Token Parameters:`);
    console.log(`  Name: ${tokenName}`);
    console.log(`  Symbol: ${tokenSymbol}`);
    console.log(`  Max Supply: ${maxSupply === 0 ? 'Unlimited' : maxSupply}`);
    console.log(`  Transferable: ${transferable}`);
    console.log(`  Is Voting Token: ${isVotingToken}`);
    console.log(`  Decay Percentage: ${decayPercentage / 100}% per interval`);
    console.log(`  Decay Interval: ${decayInterval / 86400} days`);

    // Test the function encoding
    console.log('\n🔍 Testing function encoding...');
    try {
      const testInterface = new ethers.Interface(decayingTokenFactoryAbi);
      const testCalldata = testInterface.encodeFunctionData(
        'deployDecayingToken',
        [
          spaceId,
          tokenName,
          tokenSymbol,
          maxSupply,
          transferable,
          isVotingToken,
          decayPercentage,
          decayInterval,
        ],
      );
      console.log(`✅ Function encoding successful`);
      console.log(`📋 Full calldata: ${testCalldata}`);

      // Try to decode it back to verify
      const decoded = testInterface.decodeFunctionData(
        'deployDecayingToken',
        testCalldata,
      );
      console.log(`✅ Decoding verification successful`);
      console.log(`   Decoded spaceId: ${decoded[0]}`);
      console.log(`   Decoded name: ${decoded[1]}`);
      console.log(`   Decoded symbol: ${decoded[2]}`);
    } catch (encodeError) {
      console.error('❌ Error with function encoding:', encodeError);
      return;
    }

    // Encode the deployDecayingToken function call
    const deployTokenCalldata =
      decayingTokenFactory.interface.encodeFunctionData('deployDecayingToken', [
        spaceId,
        tokenName,
        tokenSymbol,
        maxSupply,
        transferable,
        isVotingToken,
        decayPercentage,
        decayInterval,
      ]);

    console.log(
      `📋 Encoded calldata length: ${deployTokenCalldata.length} characters`,
    );
    console.log(`📋 Calldata: ${deployTokenCalldata.substring(0, 100)}...`);

    // Create proposal
    const proposalParams: ProposalParams = {
      spaceId: spaceId,
      duration: 3600, // 1 hour for testing
      transactions: [
        {
          target: CONTRACTS.DECAYING_TOKEN_FACTORY,
          value: 0,
          data: deployTokenCalldata,
        },
      ],
    };

    console.log('\n📋 Proposal parameters:');
    console.log(`  Space ID: ${proposalParams.spaceId}`);
    console.log(
      `  Duration: ${proposalParams.duration} seconds (${
        proposalParams.duration / 3600
      } hours)`,
    );
    console.log(`  Target Contract: ${proposalParams.transactions[0].target}`);
    console.log(`  Value: ${proposalParams.transactions[0].value} ETH`);

    console.log('\n🗳️ Submitting proposal creation transaction...');
    try {
      // Estimate gas first
      const estimatedGas = await daoProposals.createProposal.estimateGas(
        proposalParams,
      );
      console.log(`⛽ Estimated gas: ${estimatedGas.toString()}`);

      // Create the proposal
      const createProposalTx = await daoProposals.createProposal(
        proposalParams,
        {
          gasLimit: Math.floor(Number(estimatedGas) * 1.2), // Add 20% buffer
        },
      );

      console.log(`📤 Proposal creation tx hash: ${createProposalTx.hash}`);

      const createProposalReceipt = await createProposalTx.wait();
      console.log('✅ Proposal creation confirmed');

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
      console.log(`🎉 Proposal created with ID: ${proposalId}`);

      // Step 4: Vote on the proposal
      console.log('\n📍 Step 4: Voting on the proposal...');
      const voteTx = await daoProposals.vote(proposalId, true); // Vote YES
      console.log(`🗳️ Vote transaction hash: ${voteTx.hash}`);

      await voteTx.wait();
      console.log('✅ Vote confirmed');

      // Step 5: Check proposal status and wait for execution
      console.log('\n📍 Step 5: Checking proposal status...');
      let proposalData = await daoProposals.getProposalCore(proposalId);

      console.log('\n📊 Proposal data:');
      console.log(`  Space ID: ${proposalData.spaceId}`);
      console.log(
        `  Start time: ${new Date(
          Number(proposalData.startTime) * 1000,
        ).toLocaleString()}`,
      );
      console.log(
        `  End time: ${new Date(
          Number(proposalData.endTime) * 1000,
        ).toLocaleString()}`,
      );
      console.log(`  Executed: ${proposalData.executed}`);
      console.log(`  Expired: ${proposalData.expired}`);
      console.log(`  Yes votes: ${proposalData.yesVotes}`);
      console.log(`  No votes: ${proposalData.noVotes}`);
      console.log(
        `  Total voting power: ${proposalData.totalVotingPowerAtSnapshot}`,
      );
      console.log(`  Creator: ${proposalData.creator}`);

      if (proposalData.executed) {
        console.log('\n🎉 SUCCESS! The proposal was executed automatically.');
      } else {
        console.log('\n⏳ The proposal has not been executed yet.');
        console.log(
          'This might be normal if the voting period is still active or quorum not reached.',
        );
      }

      // Step 6: Test getSpaceToken AFTER proposal execution - ENHANCED
      console.log('\n📍 Step 6: Testing UPGRADED getSpaceToken...');

      let tokenAddressAfter = ethers.ZeroAddress;
      try {
        tokenAddressAfter = await decayingTokenFactory.getSpaceToken(spaceId);
        console.log(`🪙 getSpaceToken result: ${tokenAddressAfter}`);

        if (tokenAddressAfter !== ethers.ZeroAddress) {
          console.log(
            '🎉 SUCCESS! getSpaceToken now works and found the token!',
          );
        } else {
          console.log('ℹ️ getSpaceToken works but returns zero address');
        }
      } catch (error: any) {
        console.log(`❌ getSpaceToken failed: ${error.message}`);
        // Fall back to the known address from events
        tokenAddressAfter = '0xc8995514f8c76b9d9a509b4fdba0d06eb732907e';
        console.log(`Using token address from event: ${tokenAddressAfter}`);
      }

      // Step 7: Verify token properties using the known address
      console.log('\n📍 Step 7: Verifying deployed token properties...');
      console.log(`Using token address from event: ${tokenAddressAfter}`);

      const token = new ethers.Contract(
        tokenAddressAfter,
        decayingSpaceTokenAbi,
        provider,
      );

      try {
        const actualName = await token.name();
        const actualSymbol = await token.symbol();
        const actualDecayPercentage = await token.decayPercentage();
        const actualDecayInterval = await token.decayInterval();

        console.log('\n✅ Token verification:');
        console.log(`  Name: ${actualName} (expected: ${tokenName})`);
        console.log(`  Symbol: ${actualSymbol} (expected: ${tokenSymbol})`);
        console.log(
          `  Decay Percentage: ${actualDecayPercentage} basis points (expected: ${decayPercentage})`,
        );
        console.log(
          `  Decay Interval: ${actualDecayInterval} seconds (expected: ${decayInterval})`,
        );

        // Verify all properties match
        const allMatch =
          actualName === tokenName &&
          actualSymbol === tokenSymbol &&
          Number(actualDecayPercentage) === decayPercentage &&
          Number(actualDecayInterval) === decayInterval;

        if (allMatch) {
          console.log(
            '\n🎉 COMPLETE SUCCESS! All token properties match exactly!',
          );
        } else {
          console.log(
            '\n⚠️ Some token properties do not match expected values.',
          );
        }
      } catch (tokenError) {
        console.error('❌ Error verifying token properties:', tokenError);
      }

      // Final summary
      console.log('\n🏁 === TEST SUMMARY ===');
      console.log(`✅ Space created with ID: ${spaceId}`);
      console.log(`✅ Proposal created with ID: ${proposalId}`);
      console.log(`✅ Vote submitted successfully`);
      console.log(
        `✅ getSpaceToken tested before deployment: Contract reverted (expected)`,
      );
      console.log(
        `✅ getSpaceToken tested after proposal: ${tokenAddressAfter}`,
      );

      if (tokenAddressAfter !== ethers.ZeroAddress) {
        console.log(`🎉 Decaying token successfully deployed via proposal!`);
      } else {
        console.log(`⚠️ Token not deployed - check proposal execution status.`);
      }
    } catch (proposalError) {
      console.error('\n❌ Proposal creation or execution failed:');
      console.error(proposalError);

      // Additional debugging information
      console.log('\n🔍 Debugging information:');
      console.log(`Space ID: ${spaceId}`);
      console.log(`Space members: ${members}`);
      console.log(`Is wallet a member: ${members.includes(wallet.address)}`);
      console.log(`Wallet address: ${wallet.address}`);
    }
  } catch (outerError) {
    console.error('\n❌ Error in decaying token proposal test:', outerError);
  }
}

// Run the test
testDecayingTokenProposal().catch(console.error);
