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
  value: bigint | number;
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

// RegularTokenFactory ABI
const regularTokenFactoryAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
      { internalType: 'string', name: '_name', type: 'string' },
      { internalType: 'string', name: '_symbol', type: 'string' },
      { internalType: 'uint256', name: '_maxSupply', type: 'uint256' },
      { internalType: 'bool', name: '_transferable', type: 'bool' },
      { internalType: 'bool', name: '_isVotingToken', type: 'bool' },
    ],
    name: 'deployToken',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_spaceId', type: 'uint256' }],
    name: 'getSpaceToken',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
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
      { indexed: false, internalType: 'string', name: 'name', type: 'string' },
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

// SpaceToken ABI
const spaceTokenAbi = [
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
    name: 'totalSupply',
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
    name: 'executor',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function testExecutorMintFunctionality(): Promise<void> {
  console.log('🚀 Starting executor transfer-as-mint functionality test...\n');

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
      accountData = [
        {
          privateKey: cleanPrivateKey,
          address: wallet.address,
        },
      ];
    }
  }

  if (accountData.length === 0) {
    console.error('❌ No accounts found. Please provide PRIVATE_KEY in .env');
    return;
  }

  const wallet = new ethers.Wallet(accountData[0].privateKey, provider);
  console.log(`📝 Using wallet address: ${wallet.address}`);

  // Initialize contracts
  const daoSpaceFactory = new ethers.Contract(
    process.env.DAO_SPACE_FACTORY_ADDRESS ||
      '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9',
    daoSpaceFactoryAbi,
    wallet,
  );

  const regularTokenFactory = new ethers.Contract(
    process.env.REGULAR_TOKEN_FACTORY_ADDRESS ||
      '0x95A33EC94de2189893884DaD63eAa19f7390144a', // Updated with correct address from addresses.txt
    regularTokenFactoryAbi,
    wallet,
  );

  const daoProposals = new ethers.Contract(
    process.env.DAO_PROPOSALS_ADDRESS ||
      '0x001bA7a00a259Fb12d7936455e292a60FC2bef14',
    daoProposalsAbi,
    wallet,
  );

  console.log('📋 Contract addresses:');
  console.log(`   DAO Space Factory: ${daoSpaceFactory.target}`);
  console.log(`   Regular Token Factory: ${regularTokenFactory.target}`);
  console.log(`   DAO Proposals: ${daoProposals.target}\n`);

  try {
    // Step 1: Create a Space
    console.log('🏗️  STEP 1: Creating a new space...');
    const spaceParams: SpaceCreationParams = {
      unity: 51, // 51% unity - single address can pass
      quorum: 51, // 51% quorum - single address can pass
      votingPowerSource: 2, // Space voting power (1 member = 1 vote)
      exitMethod: 1,
      joinMethod: 1,
    };

    const spaceTx = await daoSpaceFactory.createSpace(spaceParams);
    console.log(`   Transaction submitted: ${spaceTx.hash}`);

    const spaceReceipt = await spaceTx.wait();
    console.log('   ✅ Space creation confirmed');

    // Find the SpaceCreated event
    const spaceEvent = spaceReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'SpaceCreated(uint256,uint256,uint256,uint256,uint256,uint256,address,address)',
        ),
    );

    if (!spaceEvent) {
      console.error('❌ Space creation event not found');
      return;
    }

    const spaceId = parseInt(spaceEvent.topics[1], 16);
    console.log(`   🆔 Space created with ID: ${spaceId}`);

    // Get space executor
    const executorAddress = await daoSpaceFactory.getSpaceExecutor(spaceId);
    console.log(`   🤖 Space executor address: ${executorAddress}\n`);

    // Step 2: Deploy a Token for the Space VIA PROPOSAL
    console.log(
      '🪙 STEP 2: Creating proposal to deploy a token for the space...',
    );

    // Encode the token deployment function call
    const deployTokenData = regularTokenFactory.interface.encodeFunctionData(
      'deployToken',
      [
        spaceId, // spaceId
        'Test Token', // name
        'TEST', // symbol
        0, // maxSupply (0 = unlimited)
        true, // transferable
        false, // isVotingToken (not a voting token to avoid conflicts)
      ],
    );

    const deployProposalParams: ProposalParams = {
      spaceId: spaceId,
      duration: 3600, // 1 hour
      transactions: [
        {
          target: await regularTokenFactory.getAddress(),
          value: 0, // No ETH transfer
          data: deployTokenData,
        },
      ],
    };

    console.log(`   🎯 Target: ${await regularTokenFactory.getAddress()}`);
    console.log(`   📝 Function: deployToken`);
    console.log(`   📛 Token name: Test Token`);
    console.log(`   🏷️  Token symbol: TEST`);

    const deployProposalTx = await daoProposals.createProposal(
      deployProposalParams,
    );
    console.log(`   Transaction submitted: ${deployProposalTx.hash}`);

    const deployProposalReceipt = await deployProposalTx.wait();
    console.log('   ✅ Token deployment proposal creation confirmed');

    // Find the ProposalCreated event
    const deployProposalEvent = deployProposalReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'ProposalCreated(uint256,uint256,uint256,uint256,address,bytes)',
        ),
    );

    if (!deployProposalEvent) {
      console.error('❌ Token deployment proposal creation event not found');
      return;
    }

    const deployProposalId = parseInt(deployProposalEvent.topics[1], 16);
    console.log(
      `   🆔 Token deployment proposal created with ID: ${deployProposalId}`,
    );

    // Vote on the token deployment proposal
    console.log('   🗳️  Voting on token deployment proposal...');
    const deployVoteTx = await daoProposals.vote(deployProposalId, true); // Vote YES
    console.log(`   Vote transaction submitted: ${deployVoteTx.hash}`);

    await deployVoteTx.wait();
    console.log('   ✅ Token deployment vote confirmed');

    // Check if deployment proposal was executed
    const deployProposalData = await daoProposals.getProposalCore(
      deployProposalId,
    );
    if (!deployProposalData.executed) {
      console.error('❌ Token deployment proposal was not executed');
      console.log(`   Executed: ${deployProposalData.executed}`);
      console.log(`   Expired: ${deployProposalData.expired}`);
      return;
    }

    console.log('   ✅ Token deployment proposal executed successfully!\n');

    // Get the deployed token address
    console.log('🔍 STEP 2.5: Finding the deployed token...');
    const spaceTokens = await regularTokenFactory.getSpaceToken(spaceId);
    if (spaceTokens.length === 0) {
      console.error('❌ No tokens found for the space after deployment');
      return;
    }

    const tokenAddress = spaceTokens[spaceTokens.length - 1]; // Get the latest token
    console.log(`   🎯 Token deployed at: ${tokenAddress}`);

    const token = new ethers.Contract(tokenAddress, spaceTokenAbi, wallet);

    // Verify token properties
    const tokenName = await token.name();
    const tokenSymbol = await token.symbol();
    const tokenExecutor = await token.executor();

    console.log(`   📛 Token name: ${tokenName}`);
    console.log(`   🏷️  Token symbol: ${tokenSymbol}`);
    console.log(`   🤖 Token executor: ${tokenExecutor}`);
    console.log(
      `   ✅ Executor addresses match: ${
        tokenExecutor.toLowerCase() === executorAddress.toLowerCase()
      }\n`,
    );

    // Step 3: Create Proposal to Transfer from Executor
    console.log(
      '📝 STEP 3: Creating proposal for executor transfer (this should mint)...',
    );

    const transferAmount = ethers.parseUnits('100', 18); // 100 TEST tokens

    // Encode the token transfer function call
    const transferData = token.interface.encodeFunctionData('transfer', [
      wallet.address, // recipient
      transferAmount, // amount
    ]);

    const proposalParams: ProposalParams = {
      spaceId: spaceId,
      duration: 3600, // 1 hour
      transactions: [
        {
          target: tokenAddress,
          value: 0, // No ETH transfer
          data: transferData,
        },
      ],
    };

    console.log(`   🎯 Target: ${tokenAddress}`);
    console.log(
      `   💸 Transfer amount: ${ethers.formatUnits(transferAmount, 18)} TEST`,
    );
    console.log(`   👤 Recipient: ${wallet.address}`);
    console.log(`   🤖 This will be executed by executor: ${executorAddress}`);

    const proposalTx = await daoProposals.createProposal(proposalParams);
    console.log(`   Transaction submitted: ${proposalTx.hash}`);

    const proposalReceipt = await proposalTx.wait();
    console.log('   ✅ Transfer proposal creation confirmed');

    // Find the ProposalCreated event
    const proposalEvent = proposalReceipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id(
          'ProposalCreated(uint256,uint256,uint256,uint256,address,bytes)',
        ),
    );

    if (!proposalEvent) {
      console.error('❌ Transfer proposal creation event not found');
      return;
    }

    const proposalId = parseInt(proposalEvent.topics[1], 16);
    console.log(`   🆔 Transfer proposal created with ID: ${proposalId}\n`);

    // Step 4: Vote on the Transfer Proposal
    console.log('🗳️  STEP 4: Voting on the transfer proposal...');

    const voteTx = await daoProposals.vote(proposalId, true); // Vote YES
    console.log(`   Transaction submitted: ${voteTx.hash}`);

    await voteTx.wait();
    console.log('   ✅ Vote confirmed\n');

    // Step 5: Check Proposal Status and Results
    console.log('🔍 STEP 5: Checking if transfer proposal was executed...');

    const proposalData = await daoProposals.getProposalCore(proposalId);

    console.log('   📋 Transfer proposal status:');
    console.log(`      - Executed: ${proposalData.executed}`);
    console.log(`      - Expired: ${proposalData.expired}`);
    console.log(`      - Yes votes: ${proposalData.yesVotes}`);
    console.log(`      - No votes: ${proposalData.noVotes}`);

    if (proposalData.executed) {
      console.log('   ✅ Transfer proposal was executed!\n');

      console.log('🎉 SUCCESS! The executor transfer proposal was executed.');
      console.log('   ✅ If your contract modification works correctly:');
      console.log(
        '      - The executor calling transfer() should have minted tokens',
      );
      console.log('      - Total supply should have increased');
      console.log('      - Your wallet should have received 100 TEST tokens');
      console.log('      - Executor balance should be unchanged');
      console.log('\n📝 Now verifying the mint functionality...\n');

      // Step 6: Verify Token State to Confirm Minting
      console.log('🔍 STEP 6: Verifying that tokens were minted...');

      try {
        const finalTotalSupply = await token.totalSupply();
        const finalWalletBalance = await token.balanceOf(wallet.address);
        const finalExecutorBalance = await token.balanceOf(executorAddress);

        console.log('📊 FINAL TOKEN STATE:');
        console.log(
          `   📈 Total supply: ${ethers.formatUnits(
            finalTotalSupply,
            18,
          )} TEST`,
        );
        console.log(
          `   💰 Your wallet balance: ${ethers.formatUnits(
            finalWalletBalance,
            18,
          )} TEST`,
        );
        console.log(
          `   🤖 Executor balance: ${ethers.formatUnits(
            finalExecutorBalance,
            18,
          )} TEST\n`,
        );

        // Verify the mint functionality worked
        const expectedAmount = transferAmount;
        const totalSupplyMatch = finalTotalSupply === expectedAmount;
        const walletBalanceMatch = finalWalletBalance === expectedAmount;
        const executorBalanceIsZero = finalExecutorBalance === BigInt(0);

        console.log('✅ VERIFICATION RESULTS:');
        console.log(
          `   📈 Total supply is 100 TEST: ${
            totalSupplyMatch ? '✅ YES' : '❌ NO'
          }`,
        );
        console.log(
          `   💰 Wallet balance is 100 TEST: ${
            walletBalanceMatch ? '✅ YES' : '❌ NO'
          }`,
        );
        console.log(
          `   🤖 Executor balance is 0 TEST: ${
            executorBalanceIsZero ? '✅ YES' : '❌ NO'
          }\n`,
        );

        if (totalSupplyMatch && walletBalanceMatch && executorBalanceIsZero) {
          console.log('🎉🎉 COMPLETE SUCCESS! 🎉🎉');
          console.log(
            '   ✅ Executor transfer-as-mint functionality works perfectly!',
          );
          console.log(
            '   ✅ Total supply increased by 100 (tokens were minted)',
          );
          console.log('   ✅ Your wallet received 100 tokens');
          console.log(
            '   ✅ Executor balance unchanged (no actual transfer occurred)',
          );
          console.log(
            '\n🔥 Your contract modification is working correctly! 🔥',
          );
        } else {
          console.log(
            '❌ ISSUE: The mint functionality did not work as expected',
          );
          console.log(
            `   Expected total supply: ${ethers.formatUnits(
              expectedAmount,
              18,
            )} TEST`,
          );
          console.log(
            `   Actual total supply: ${ethers.formatUnits(
              finalTotalSupply,
              18,
            )} TEST`,
          );
          console.log(
            `   Expected wallet balance: ${ethers.formatUnits(
              expectedAmount,
              18,
            )} TEST`,
          );
          console.log(
            `   Actual wallet balance: ${ethers.formatUnits(
              finalWalletBalance,
              18,
            )} TEST`,
          );
          console.log(`   Expected executor balance: 0 TEST`);
          console.log(
            `   Actual executor balance: ${ethers.formatUnits(
              finalExecutorBalance,
              18,
            )} TEST`,
          );

          if (!totalSupplyMatch || !walletBalanceMatch) {
            console.log('\n💡 Possible issues:');
            console.log(
              '   - The contract might not have the mint functionality implemented',
            );
            console.log('   - The executor address check might not be working');
            console.log('   - There might be a revert in the mint function');
          }
        }
      } catch (verificationError) {
        console.error(
          '❌ Error during token state verification:',
          verificationError,
        );
        console.log('\n🔍 Manual verification addresses:');
        console.log(`   Token contract: ${tokenAddress}`);
        console.log(`   Your wallet: ${wallet.address}`);
        console.log(`   Executor: ${executorAddress}`);
      }
    } else {
      console.log('❌ Transfer proposal was not executed.');

      if (Date.now() / 1000 < Number(proposalData.endTime)) {
        console.log(
          `   ⏰ Voting period ends at: ${new Date(
            Number(proposalData.endTime) * 1000,
          ).toLocaleString()}`,
        );
      }

      if (proposalData.expired) {
        console.log('   ⏰ Proposal has expired without execution');
      }
    }
  } catch (error) {
    console.error('❌ Error during test execution:', error);

    if (error.message && error.message.includes('f')) {
      console.log('\n🔍 This might be the "f" error you mentioned earlier.');
      console.log('   Possible causes:');
      console.log('   1. Token contract executor address mismatch');
      console.log('   2. Max supply constraint');
      console.log('   3. Gas estimation issues');
      console.log('   4. Contract state issues');
    }
  }
}

// Run the test
testExecutorMintFunctionality().catch(console.error);
