import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

// Import the compiled contract artifacts
const transferHelperArtifacts = require('../../artifacts/contracts/TransferHelper.sol/TransferHelper.json');

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

// USDC token ABI (simplified)
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
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

/**
 * Test TransferHelper with Smart Account behavior (using approve + transferFrom pattern)
 * This demonstrates the correct way to use TransferHelper and how smart accounts solve UX issues
 */
async function testTransferHelperWithSmartAccountPattern(): Promise<void> {
  console.log('🚀 Testing TransferHelper with Smart Account Pattern');
  console.log(
    '🤖 This shows how smart accounts solve the allowance UX problem!\n',
  );

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
  console.log(`👤 Wallet address: ${wallet.address}`);

  // USDC on Base Mainnet
  const usdcAddress =
    process.env.USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const usdcToken = new ethers.Contract(usdcAddress, erc20Abi, wallet);

  // Transfer amount: 0.000100 USDC (100 units with 6 decimals)
  const transferAmount = ethers.parseUnits('0.000100', 6);
  console.log(
    `💰 Transfer amount: ${ethers.formatUnits(transferAmount, 6)} USDC`,
  );

  // Check initial wallet balance
  const initialBalance = await usdcToken.balanceOf(wallet.address);
  console.log(
    `🏦 Wallet USDC balance: ${ethers.formatUnits(initialBalance, 6)} USDC`,
  );

  if (initialBalance < transferAmount) {
    console.error(
      `❌ Insufficient USDC balance. Need at least ${ethers.formatUnits(
        transferAmount,
        6,
      )} USDC.`,
    );
    console.log(
      `Please fund wallet ${wallet.address} with USDC and try again.`,
    );
    return;
  }

  try {
    // Step 1: Deploy TransferHelper contract using compiled artifacts
    console.log('\n🔧 Step 1: Deploying TransferHelper contract...');

    let transferHelperAddress = process.env.TRANSFER_HELPER_ADDRESS;
    let transferHelper: any;

    if (!transferHelperAddress) {
      const transferHelperFactory = new ethers.ContractFactory(
        transferHelperArtifacts.abi,
        transferHelperArtifacts.bytecode,
        wallet,
      );

      transferHelper = await transferHelperFactory.deploy();
      await transferHelper.waitForDeployment();
      transferHelperAddress = await transferHelper.getAddress();
      console.log(`🏭 TransferHelper deployed at: ${transferHelperAddress}`);
    } else {
      console.log(
        `🏭 Using existing TransferHelper at: ${transferHelperAddress}`,
      );
      transferHelper = new ethers.Contract(
        transferHelperAddress,
        transferHelperArtifacts.abi,
        wallet,
      );
    }

    // Step 2: Create receiver address
    const receiverAddress = ethers.Wallet.createRandom().address;
    console.log(`📬 Receiver address: ${receiverAddress}`);

    // Step 3: The CORRECT way to use TransferHelper (what smart accounts do automatically)
    console.log(
      '\n⚡ Step 3: Using TransferHelper correctly (Smart Account Pattern)',
    );
    console.log(
      '🤖 Smart accounts can do this automatically in a single user transaction!\n',
    );

    // Step 3a: Approve TransferHelper to spend our USDC
    console.log('📝 Step 3a: Approving TransferHelper to spend USDC...');
    const approveTx = await usdcToken.approve(
      transferHelperAddress,
      transferAmount,
    );
    await approveTx.wait();
    console.log('✅ Approved TransferHelper to spend USDC');

    // Verify the approval
    const allowance = await usdcToken.allowance(
      wallet.address,
      transferHelperAddress,
    );
    console.log(`🔓 Allowance set: ${ethers.formatUnits(allowance, 6)} USDC`);

    // Step 3b: Call TransferHelper.transferToken (which uses transferFrom)
    console.log('\n🔄 Step 3b: Calling TransferHelper.transferToken...');
    console.log(
      '   This will use transferFrom to move tokens from caller to receiver',
    );

    const transferTx = await transferHelper.transferToken(
      usdcAddress,
      receiverAddress,
      transferAmount,
    );
    console.log(`Transaction hash: ${transferTx.hash}`);

    const receipt = await transferTx.wait();
    console.log('✅ TransferHelper.transferToken executed successfully!');

    // Check for TransferExecuted event
    const transferEvent = receipt?.logs.find(
      (log) =>
        log.topics[0] ===
        ethers.id('TransferExecuted(address,address,uint256)'),
    );

    if (transferEvent) {
      console.log('🎉 TransferExecuted event found!');

      const decodedEvent = transferHelper.interface.parseLog({
        topics: transferEvent.topics,
        data: transferEvent.data,
      });

      if (decodedEvent) {
        console.log(`📊 Event details:`);
        console.log(`   - Token: ${decodedEvent.args.token}`);
        console.log(`   - To: ${decodedEvent.args.to}`);
        console.log(
          `   - Amount: ${ethers.formatUnits(
            decodedEvent.args.amount,
            6,
          )} USDC`,
        );
      }
    }

    // Step 4: Verify the results
    console.log('\n🔍 Step 4: Verifying the transfer...');

    const finalWalletBalance = await usdcToken.balanceOf(wallet.address);
    const finalReceiverBalance = await usdcToken.balanceOf(receiverAddress);
    const finalAllowance = await usdcToken.allowance(
      wallet.address,
      transferHelperAddress,
    );

    console.log(
      `🏦 Wallet final balance: ${ethers.formatUnits(
        finalWalletBalance,
        6,
      )} USDC`,
    );
    console.log(
      `📬 Receiver final balance: ${ethers.formatUnits(
        finalReceiverBalance,
        6,
      )} USDC`,
    );
    console.log(
      `🔓 Remaining allowance: ${ethers.formatUnits(finalAllowance, 6)} USDC`,
    );

    // Check if transfer was successful
    const transferSuccessful = finalReceiverBalance >= transferAmount;
    const walletDeducted =
      finalWalletBalance === initialBalance - transferAmount;

    if (transferSuccessful && walletDeducted) {
      console.log(
        '\n🎉 SUCCESS! TransferHelper works correctly with approve+transfer pattern!',
      );
    } else {
      console.log('\n❌ Transfer verification failed.');
    }

    console.log('\n📊 Test Summary:');
    console.log('='.repeat(80));
    console.log(
      `✅ Amount transferred: ${ethers.formatUnits(transferAmount, 6)} USDC`,
    );
    console.log(`🏭 TransferHelper address: ${transferHelperAddress}`);
    console.log(`👤 Sender wallet: ${wallet.address}`);
    console.log(`📬 Receiver address: ${receiverAddress}`);
    console.log(
      `✅ Transaction successful: ${transferSuccessful && walletDeducted}`,
    );
    console.log(`🔄 Used approve + transferFrom pattern: ✅`);
    console.log('='.repeat(80));

    console.log('\n💡 Key Insights:');
    console.log('✅ TransferHelper uses transferFrom, not transfer');
    console.log('✅ Caller must approve TransferHelper first');
    console.log('✅ TransferHelper transfers from caller to recipient');
    console.log('✅ This pattern works perfectly with your contract design');

    console.log('\n🤖 Why Smart Accounts solve the UX problem:');
    console.log('• Regular users need 2 transactions: approve + transferToken');
    console.log('• Smart accounts can batch both into 1 user signature');
    console.log('• Smart accounts handle approvals programmatically');
    console.log('• Users never see "allowance" complexity');
    console.log(
      '• Perfect UX: user signs once, smart account executes sequence',
    );
    console.log('• Your TransferHelper works exactly the same way!');

    console.log('\n🚀 Smart Account Advantages:');
    console.log('• ⚡ Gasless transactions (with paymasters)');
    console.log('• 📦 Batch multiple operations');
    console.log('• 🔐 Custom authentication methods');
    console.log('• 🎛️  Advanced spending controls');
    console.log('• 🤝 Perfect compatibility with existing contracts');
    console.log('• 🎯 Your TransferHelper is Smart Account ready!');
  } catch (error) {
    console.error('❌ Error during test:', error);

    console.log('\nDebugging information:');
    console.log(`- USDC contract: ${usdcAddress}`);
    console.log(`- Wallet address: ${wallet.address}`);
    console.log(`- Transfer amount: ${transferAmount.toString()} units`);

    if (error.message.includes('allowance')) {
      console.log('\n💡 This is exactly the UX problem Smart Accounts solve!');
      console.log('With smart accounts:');
      console.log('1. User signs one transaction intent');
      console.log(
        '2. Smart account handles approve + transferToken automatically',
      );
      console.log('3. Perfect UX - no manual allowances needed!');
    }
  }
}

// Run the test
testTransferHelperWithSmartAccountPattern().catch(console.error);
