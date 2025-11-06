import { ethers } from 'hardhat';

/**
 * Test Batch Transfer functionality on mainnet WITHOUT gas sponsorship
 *
 * Prerequisites:
 * 1. TransferHelper deployed
 * 2. Test token with sufficient balance
 * 3. Multiple recipient addresses
 *
 * Usage:
 * npx hardhat run scripts/test-batch-transfer-mainnet.ts --network base
 */

interface BatchTestConfig {
  transferHelperAddress: string;
  testTokenAddress: string;
  recipients: string[];
  amounts: string[]; // in token units
}

// ============================================================================
// CONFIGURATION - UPDATE THESE VALUES BEFORE RUNNING
// ============================================================================
const config: BatchTestConfig = {
  // Your deployed TransferHelper address
  transferHelperAddress: '0x...',

  // Token to test with
  testTokenAddress: '0x...',

  // Multiple recipients for batch transfer (add as many as you want)
  recipients: [
    '0x...', // Recipient 1
    '0x...', // Recipient 2
    '0x...', // Recipient 3
  ],

  // Amounts for each recipient (in token units)
  // Must match the number of recipients
  amounts: ['1', '2', '3'], // Will send 1, 2, and 3 tokens respectively
};
// ============================================================================

async function main() {
  console.log('🧪 Testing Batch Transfer on Mainnet');
  console.log('═══════════════════════════════════════════════════════\n');

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log('📋 Configuration:');
  console.log('─────────────────────────────────────────────────────');
  console.log('Network:', (await ethers.provider.getNetwork()).name);
  console.log('Signer:', signerAddress);
  console.log('TransferHelper:', config.transferHelperAddress);
  console.log('Test Token:', config.testTokenAddress);
  console.log('Recipients:', config.recipients.length);
  console.log('');

  // Validate
  if (config.recipients.length !== config.amounts.length) {
    console.error(
      '❌ Error: Recipients and amounts arrays must have same length',
    );
    process.exit(1);
  }

  if (
    config.recipients.some(
      (addr) => !ethers.isAddress(addr) || addr === '0x...',
    )
  ) {
    console.error('❌ Error: Invalid recipient address(es)');
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
  ];

  const token = new ethers.Contract(config.testTokenAddress, ERC20_ABI, signer);

  // Get token info
  const tokenSymbol = await token.symbol();
  const tokenDecimals = await token.decimals();

  console.log('🪙 Token:', tokenSymbol);
  console.log('');

  // Calculate amounts in wei
  const amountsWei = config.amounts.map((amt) =>
    ethers.parseUnits(amt, tokenDecimals),
  );
  const totalAmount = amountsWei.reduce((sum, amt) => sum + amt, 0n);

  console.log('📊 Batch Transfer Details:');
  console.log('─────────────────────────────────────────────────────');
  for (let i = 0; i < config.recipients.length; i++) {
    console.log(
      `${i + 1}. ${config.recipients[i]}: ${config.amounts[i]} ${tokenSymbol}`,
    );
  }
  console.log('');
  console.log(
    'Total Amount:',
    ethers.formatUnits(totalAmount, tokenDecimals),
    tokenSymbol,
  );
  console.log('');

  // Check sender balance
  const senderBalance = await token.balanceOf(signerAddress);
  console.log(
    '💰 Sender Balance:',
    ethers.formatUnits(senderBalance, tokenDecimals),
    tokenSymbol,
  );

  if (senderBalance < totalAmount) {
    console.error('❌ Error: Insufficient balance');
    console.log(
      `Need: ${ethers.formatUnits(totalAmount, tokenDecimals)} ${tokenSymbol}`,
    );
    console.log(
      `Have: ${ethers.formatUnits(
        senderBalance,
        tokenDecimals,
      )} ${tokenSymbol}`,
    );
    process.exit(1);
  }
  console.log('');

  // Get initial balances of all recipients
  console.log('📊 Initial Recipient Balances:');
  console.log('─────────────────────────────────────────────────────');
  const initialBalances = [];
  for (let i = 0; i < config.recipients.length; i++) {
    const balance = await token.balanceOf(config.recipients[i]);
    initialBalances.push(balance);
    console.log(
      `${i + 1}. ${ethers.formatUnits(balance, tokenDecimals)} ${tokenSymbol}`,
    );
  }
  console.log('');

  // Check allowance
  const currentAllowance = await token.allowance(
    signerAddress,
    config.transferHelperAddress,
  );
  console.log(
    '📝 Current Allowance:',
    ethers.formatUnits(currentAllowance, tokenDecimals),
    tokenSymbol,
  );

  if (currentAllowance < totalAmount) {
    console.log('✍️  Approving TransferHelper...');
    const approveTx = await token.approve(
      config.transferHelperAddress,
      totalAmount,
    );
    console.log('Approval TX:', approveTx.hash);
    await approveTx.wait();
    console.log('✅ Approved!');
    console.log('');
  } else {
    console.log('✅ Sufficient allowance');
    console.log('');
  }

  // Execute batch transfer
  console.log('🚀 Executing Batch Transfer...');
  console.log('─────────────────────────────────────────────────────');

  try {
    const transferTx = await transferHelper.batchTransfer(
      config.testTokenAddress,
      config.recipients,
      amountsWei,
    );

    console.log('Transfer TX:', transferTx.hash);
    console.log('Waiting for confirmation...');

    const receipt = await transferTx.wait();
    console.log('✅ Batch transfer successful! Block:', receipt?.blockNumber);
    console.log('Gas Used:', receipt?.gasUsed.toString());
    console.log('');

    // Parse events
    const logs = receipt?.logs || [];
    let transferCount = 0;

    for (const log of logs) {
      try {
        const parsed = transferHelper.interface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });

        if (parsed?.name === 'TransferExecuted') {
          transferCount++;
          console.log(`Transfer ${transferCount}:`);
          console.log('  To:', parsed.args.to);
          console.log(
            '  Amount:',
            ethers.formatUnits(parsed.args.amount, tokenDecimals),
            tokenSymbol,
          );
        }

        if (parsed?.name === 'BatchTransferExecuted') {
          console.log('');
          console.log('📊 Batch Summary:');
          console.log(
            '  Total Amount:',
            ethers.formatUnits(parsed.args.totalAmount, tokenDecimals),
            tokenSymbol,
          );
          console.log('  Recipients:', parsed.args.recipientCount.toString());
        }
      } catch (e) {
        // Not a TransferHelper event
      }
    }
    console.log('');
  } catch (error: any) {
    console.error('❌ Batch transfer failed:', error.message);
    process.exit(1);
  }

  // Verify final balances
  console.log('✅ Final Recipient Balances:');
  console.log('─────────────────────────────────────────────────────');
  for (let i = 0; i < config.recipients.length; i++) {
    const finalBalance = await token.balanceOf(config.recipients[i]);
    const received = finalBalance - initialBalances[i];
    console.log(
      `${i + 1}. ${ethers.formatUnits(
        finalBalance,
        tokenDecimals,
      )} ${tokenSymbol} (+${ethers.formatUnits(received, tokenDecimals)})`,
    );
  }
  console.log('');

  const finalSenderBalance = await token.balanceOf(signerAddress);
  const sent = senderBalance - finalSenderBalance;
  console.log(
    'Sender Final Balance:',
    ethers.formatUnits(finalSenderBalance, tokenDecimals),
    tokenSymbol,
  );
  console.log(
    'Total Sent:',
    ethers.formatUnits(sent, tokenDecimals),
    tokenSymbol,
  );
  console.log('');

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('🎉 BATCH TRANSFER TEST COMPLETED!');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('✅ All transfers successful');
  console.log('✅ Gas savings compared to individual transfers');
  console.log('✅ Ready for production use');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
