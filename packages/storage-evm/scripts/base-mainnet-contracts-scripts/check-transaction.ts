import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

async function checkTransaction() {
  const txHash =
    '0xc21bd46499e14219a372d725fd7aaddff5c90d458d483f9f33c93e2564fa1196';

  console.log('🔍 CHECKING TRANSACTION');
  console.log('======================\n');
  console.log(`Transaction: ${txHash}\n`);

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  try {
    // Get transaction details
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      console.log('❌ Transaction not found');
      return;
    }

    console.log('📝 Transaction Details:');
    console.log(`  From: ${tx.from}`);
    console.log(`  To: ${tx.to}`);
    console.log(`  Value: ${ethers.formatEther(tx.value)} ETH`);
    console.log(`  Gas Limit: ${tx.gasLimit}`);
    console.log(
      `  Gas Price: ${ethers.formatUnits(tx.gasPrice || 0n, 'gwei')} Gwei`,
    );
    console.log(`  Nonce: ${tx.nonce}`);
    console.log(`  Block: ${tx.blockNumber}\n`);

    // Get receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      console.log('⏳ Transaction pending...');
      return;
    }

    console.log('📋 Receipt:');
    console.log(
      `  Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`,
    );
    console.log(
      `  Gas Used: ${receipt.gasUsed} (${
        (Number(receipt.gasUsed) * 100) / Number(tx.gasLimit)
      }% of limit)`,
    );
    console.log(`  Block: ${receipt.blockNumber}`);
    console.log(`  Confirmations: ${receipt.confirmations}\n`);

    if (receipt.status === 0) {
      console.log('❌ TRANSACTION REVERTED\n');

      // Try to get revert reason by replaying the transaction
      try {
        console.log('🔍 Attempting to get revert reason...\n');

        await provider.call({
          from: tx.from,
          to: tx.to,
          data: tx.data,
          value: tx.value,
        });

        console.log(
          '⚠️ Could not reproduce revert (transaction would succeed now)',
        );
      } catch (error: any) {
        console.log('📝 Revert Reason:');
        console.log(`  ${error.message}\n`);

        if (error.data) {
          // Try to decode error
          const errorData = error.data;

          // Standard Error(string) signature: 0x08c379a0
          if (
            typeof errorData === 'string' &&
            errorData.startsWith('0x08c379a0')
          ) {
            try {
              const reason = ethers.AbiCoder.defaultAbiCoder().decode(
                ['string'],
                '0x' + errorData.slice(10),
              )[0];
              console.log(`  Decoded: ❌ ${reason}`);
            } catch {
              console.log(`  Raw data: ${errorData}`);
            }
          } else {
            console.log(`  Raw data: ${errorData}`);
          }
        }
      }
    }

    // Decode input data
    console.log('\n📦 Decoded Input:');
    const iface = new ethers.Interface([
      'function distributeEnergyTokens(tuple(uint256 sourceId, uint256 price, uint256 quantity, bool isImport)[] sources, uint256 batteryState)',
    ]);

    try {
      const decoded = iface.parseTransaction({ data: tx.data });
      console.log(`  Function: ${decoded?.name}`);
      console.log(`  Sources: ${decoded?.args[0].length}`);
      decoded?.args[0].forEach((source: any, i: number) => {
        console.log(`    Source ${i + 1}:`);
        console.log(`      SourceId: ${source.sourceId}`);
        console.log(
          `      Price: ${ethers.formatUnits(source.price, 6)} USDC/kWh`,
        );
        console.log(`      Quantity: ${source.quantity} kWh`);
        console.log(`      IsImport: ${source.isImport}`);
      });
      console.log(`  Battery State: ${decoded?.args[1]} kWh`);
    } catch (error) {
      console.log('  Could not decode input data');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTransaction().catch(console.error);
