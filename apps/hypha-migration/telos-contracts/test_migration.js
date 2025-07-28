const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const fetch = require('node-fetch');
const { TextEncoder, TextDecoder } = require('util');

// Configuration
const TELOS_MAINNET_RPC = 'https://mainnet.telos.net';
const CONTRACT_ACCOUNT = 'migratehypha';
const PRIVATE_KEY = 'x';
const TOKEN_SYMBOL = 'HYPHA';
const TOKEN_PRECISION = 4;

// Initialize EOSJS
const signatureProvider = new JsSignatureProvider([PRIVATE_KEY]);
const rpc = new JsonRpc(TELOS_MAINNET_RPC, { fetch });
const api = new Api({
  rpc,
  signatureProvider,
  textDecoder: new TextDecoder(),
  textEncoder: new TextEncoder(),
});

// Helper function to format asset
function formatAsset(amount, symbol = TOKEN_SYMBOL, precision = TOKEN_PRECISION) {
  const amountStr = parseFloat(amount).toFixed(precision);
  return `${amountStr} ${symbol}`;
}

// Test data - single account
const TEST_ACCOUNT = 'vladislav111';
const TEST_AMOUNT = '11183883.0888';

async function testMigrationPopulate() {
  try {
    console.log('🧪 Testing Migration Population with Single Account');
    console.log('================================================');
    
    const account = TEST_ACCOUNT;
    const amount = formatAsset(TEST_AMOUNT);
    
    console.log(`Account: ${account}`);
    console.log(`Amount: ${amount}`);
    
    const action = {
      account: CONTRACT_ACCOUNT,
      name: 'populate',
      authorization: [{
        actor: CONTRACT_ACCOUNT,
        permission: 'active',
      }],
      data: {
        accounts: [account],
        amounts: [amount],
      },
    };
    
    console.log('\n📤 Sending transaction...');
    
    const result = await api.transact(
      { actions: [action] },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      }
    );
    
    console.log(`✅ Success! Transaction ID: ${result.transaction_id}`);
    console.log(`🔗 View on explorer: https://explorer.telos.net/transaction/${result.transaction_id}`);
    
  } catch (error) {
    console.error('❌ Transaction failed:', error.message);
    if (error.json) {
      console.error('Error details:', JSON.stringify(error.json, null, 2));
    }
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log('⚠️  This will populate the migration table with test data on Telos Mainnet!');
  console.log(`Contract: ${CONTRACT_ACCOUNT}`);
  console.log(`Test Account: ${TEST_ACCOUNT}`);
  console.log(`Test Amount: ${formatAsset(TEST_AMOUNT)}`);
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('\nProceed with test? (yes/no): ', async (answer) => {
    readline.close();
    
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      await testMigrationPopulate();
    } else {
      console.log('Test cancelled.');
    }
  });
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
} 