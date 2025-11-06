import { ethers } from 'hardhat';

/**
 * Test TransferHelper on mainnet (or testnet) WITHOUT gas sponsorship
 * This script tests the basic functionality using your own wallet
 *
 * Prerequisites:
 * 1. Deploy TransferHelper (run deploy-transfer-helper.ts)
 * 2. Have a test token deployed (or use existing token)
 * 3. Have some tokens in your wallet to test with
 *
 * Usage:
 * npx hardhat run scripts/test-transfer-helper-mainnet.ts --network base
 */

interface TestConfig {
  transferHelperAddress: string;
  testTokenAddress: string;
  recipientAddress: string;
  transferAmount: string; // in token units (e.g., "10" for 10 tokens)
}

// ============================================================================
// CONFIGURATION - UPDATE THESE VALUES BEFORE RUNNING
// ============================================================================
const config: TestConfig = {
  // Your deployed TransferHelper address
  transferHelperAddress: '0xBE14090eB3034a26Cea1b72d3Ebb143b06Fb0736',

  // Token to test with (use your deployed token or any ERC20)
  testTokenAddress: '0xD616548429EB5cBB3dA7A191910caDe2e27f5aFf',

  // Address to send test transfer to (use a wallet you control for testing)
  recipientAddress: '0x82f4a7807852de5667AFee822e6C960b60581498',

  // Amount to transfer (in token units, will be converted based on decimals)
  transferAmount: '100', // Transfer 1 token
};
// ============================================================================

async function main() {
  console.log('🧪 Testing TransferHelper on Mainnet');
  console.log('═══════════════════════════════════════════════════════\n');

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log('📋 Configuration:');
  console.log('─────────────────────────────────────────────────────');
  console.log('Network:', (await ethers.provider.getNetwork()).name);
  console.log('Signer:', signerAddress);
  console.log(
    'Balance:',
    ethers.formatEther(await ethers.provider.getBalance(signerAddress)),
    'ETH',
  );
  console.log('TransferHelper:', config.transferHelperAddress);
  console.log('Test Token:', config.testTokenAddress);
  console.log('Recipient:', config.recipientAddress);
  console.log('');

  // Validate configuration
  if (
    config.transferHelperAddress === '0x...' ||
    !ethers.isAddress(config.transferHelperAddress)
  ) {
    console.error('❌ Error: Invalid TransferHelper address');
    console.log(
      'Set TRANSFER_HELPER_ADDRESS environment variable or update config',
    );
    process.exit(1);
  }

  if (
    config.testTokenAddress === '0x...' ||
    !ethers.isAddress(config.testTokenAddress)
  ) {
    console.error('❌ Error: Invalid test token address');
    console.log('Set TEST_TOKEN_ADDRESS environment variable or update config');
    process.exit(1);
  }

  if (
    config.recipientAddress === '0x...' ||
    !ethers.isAddress(config.recipientAddress)
  ) {
    console.error('❌ Error: Invalid recipient address');
    console.log(
      'Set TEST_RECIPIENT_ADDRESS environment variable or update config',
    );
    process.exit(1);
  }

  // Get contracts
  const TransferHelperFactory = await ethers.getContractFactory(
    'TransferHelper',
  );
  const transferHelper = TransferHelperFactory.attach(
    config.transferHelperAddress,
  );

  const ERC20_ABI = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transfer(address to, uint256 amount) returns (bool)',
  ];

  const token = new ethers.Contract(config.testTokenAddress, ERC20_ABI, signer);

  // Get token info
  console.log('🪙 Token Information:');
  console.log('─────────────────────────────────────────────────────');

  let tokenName, tokenSymbol, tokenDecimals;
  try {
    tokenName = await token.name();
    tokenSymbol = await token.symbol();
    tokenDecimals = await token.decimals();

    console.log('Name:', tokenName);
    console.log('Symbol:', tokenSymbol);
    console.log('Decimals:', tokenDecimals);
  } catch (error) {
    console.error('❌ Error reading token info:', error);
    console.log('Make sure the token address is correct and implements ERC20');
    process.exit(1);
  }
  console.log('');

  // Check balances
  console.log('💰 Initial Balances:');
  console.log('─────────────────────────────────────────────────────');

  const senderBalance = await token.balanceOf(signerAddress);
  const recipientBalance = await token.balanceOf(config.recipientAddress);

  console.log(
    'Sender:',
    ethers.formatUnits(senderBalance, tokenDecimals),
    tokenSymbol,
  );
  console.log(
    'Recipient:',
    ethers.formatUnits(recipientBalance, tokenDecimals),
    tokenSymbol,
  );
  console.log('');

  // Calculate transfer amount in wei
  const transferAmountWei = ethers.parseUnits(
    config.transferAmount,
    tokenDecimals,
  );

  // Check if sender has enough balance
  if (senderBalance < transferAmountWei) {
    console.error('❌ Error: Insufficient token balance');
    console.log(`Need: ${config.transferAmount} ${tokenSymbol}`);
    console.log(
      `Have: ${ethers.formatUnits(
        senderBalance,
        tokenDecimals,
      )} ${tokenSymbol}`,
    );
    process.exit(1);
  }

  // Check TransferHelper status
  console.log('🔍 TransferHelper Status:');
  console.log('─────────────────────────────────────────────────────');

  const owner = await transferHelper.owner();
  const whitelistRequired = await transferHelper.requireTokenWhitelist();
  const tokenSupported = await transferHelper.isTokenSupported(
    config.testTokenAddress,
  );

  console.log('Owner:', owner);
  console.log('Whitelist Required:', whitelistRequired);
  console.log('Token Supported:', tokenSupported);
  console.log('');

  // Check if token needs to be whitelisted
  if (whitelistRequired && !tokenSupported) {
    console.log('⚠️  Token needs to be whitelisted!');
    console.log('Run this command:');
    console.log(
      `npx hardhat run scripts/register-token-with-helper.ts --network ${
        (await ethers.provider.getNetwork()).name
      }`,
    );
    console.log('');
    process.exit(1);
  }

  // Step 1: Check current allowance
  console.log('📝 Step 1: Checking Allowance');
  console.log('─────────────────────────────────────────────────────');

  const currentAllowance = await token.allowance(
    signerAddress,
    config.transferHelperAddress,
  );
  console.log(
    'Current Allowance:',
    ethers.formatUnits(currentAllowance, tokenDecimals),
    tokenSymbol,
  );

  let needsApproval = currentAllowance < transferAmountWei;
  console.log('Needs Approval:', needsApproval);
  console.log('');

  // Step 2: Approve if needed
  if (needsApproval) {
    console.log('✍️  Step 2: Approving TransferHelper');
    console.log('─────────────────────────────────────────────────────');

    try {
      const approveTx = await token.approve(
        config.transferHelperAddress,
        transferAmountWei,
      );
      console.log('Approval TX:', approveTx.hash);
      console.log('Waiting for confirmation...');

      const approveReceipt = await approveTx.wait();
      console.log('✅ Approved! Block:', approveReceipt?.blockNumber);
      console.log('Gas Used:', approveReceipt?.gasUsed.toString());
      console.log('');
    } catch (error: any) {
      console.error('❌ Approval failed:', error.message);
      process.exit(1);
    }
  } else {
    console.log('✅ Step 2: Approval not needed (sufficient allowance)');
    console.log('');
  }

  // Step 3: Execute transfer via TransferHelper
  console.log('🚀 Step 3: Executing Transfer via TransferHelper');
  console.log('─────────────────────────────────────────────────────');
  console.log('Transferring:', config.transferAmount, tokenSymbol);
  console.log('From:', signerAddress);
  console.log('To:', config.recipientAddress);
  console.log('');

  try {
    const transferTx = await transferHelper.transferToken(
      config.testTokenAddress,
      config.recipientAddress,
      transferAmountWei,
    );

    console.log('Transfer TX:', transferTx.hash);
    console.log('Waiting for confirmation...');

    const transferReceipt = await transferTx.wait();
    console.log('✅ Transfer successful! Block:', transferReceipt?.blockNumber);
    console.log('Gas Used:', transferReceipt?.gasUsed.toString());

    // Parse events
    const transferHelperInterface = transferHelper.interface;
    const logs = transferReceipt?.logs || [];

    for (const log of logs) {
      try {
        const parsed = transferHelperInterface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });

        if (parsed?.name === 'TransferExecuted') {
          console.log('');
          console.log('📊 Event: TransferExecuted');
          console.log('Token:', parsed.args.token);
          console.log('From:', parsed.args.from);
          console.log('To:', parsed.args.to);
          console.log(
            'Amount:',
            ethers.formatUnits(parsed.args.amount, tokenDecimals),
            tokenSymbol,
          );
        }
      } catch (e) {
        // Not a TransferHelper event, skip
      }
    }
    console.log('');
  } catch (error: any) {
    console.error('❌ Transfer failed:', error.message);
    process.exit(1);
  }

  // Step 4: Verify final balances
  console.log('✅ Step 4: Verifying Final Balances');
  console.log('─────────────────────────────────────────────────────');

  const finalSenderBalance = await token.balanceOf(signerAddress);
  const finalRecipientBalance = await token.balanceOf(config.recipientAddress);

  console.log(
    'Sender:',
    ethers.formatUnits(finalSenderBalance, tokenDecimals),
    tokenSymbol,
  );
  console.log(
    'Recipient:',
    ethers.formatUnits(finalRecipientBalance, tokenDecimals),
    tokenSymbol,
  );
  console.log('');

  console.log('Changes:');
  console.log(
    'Sender:',
    ethers.formatUnits(senderBalance - finalSenderBalance, tokenDecimals),
    tokenSymbol,
    '(sent)',
  );
  console.log(
    'Recipient:',
    ethers.formatUnits(finalRecipientBalance - recipientBalance, tokenDecimals),
    tokenSymbol,
    '(received)',
  );
  console.log('');

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('🎉 TEST COMPLETED SUCCESSFULLY!');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('✅ TransferHelper is working correctly');
  console.log('✅ Tokens were transferred successfully');
  console.log(
    '✅ Ready to integrate with Coinbase Paymaster for gas sponsorship',
  );
  console.log('');
  console.log('Next steps:');
  console.log('1. Whitelist TransferHelper in Coinbase Developer Portal');
  console.log('2. Configure your frontend to use TransferHelper');
  console.log('3. Test with Coinbase Smart Wallet for gas-free transfers');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
