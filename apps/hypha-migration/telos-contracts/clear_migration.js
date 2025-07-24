const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const fetch = require('node-fetch');
const { TextEncoder, TextDecoder } = require('util');

// Configuration
const TELOS_MAINNET_RPC = 'https://mainnet.telos.net';
const CONTRACT_ACCOUNT = 'migratehypha';
const PRIVATE_KEY = 'x';

// Initialize EOSJS
const signatureProvider = new JsSignatureProvider([PRIVATE_KEY]);
const rpc = new JsonRpc(TELOS_MAINNET_RPC, { fetch });
const api = new Api({
  rpc,
  signatureProvider,
  textDecoder: new TextDecoder(),
  textEncoder: new TextEncoder(),
});

async function clearMigrationTable() {
  try {
    console.log('🧹 Clearing Migration Table');
    console.log('===========================');
    
    const action = {
      account: CONTRACT_ACCOUNT,
      name: 'clear',
      authorization: [{
        actor: CONTRACT_ACCOUNT,
        permission: 'active',
      }],
      data: {}, // clear action takes no parameters
    };
    
    console.log('\n📤 Sending clear transaction...');
    
    const result = await api.transact(
      { actions: [action] },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      }
    );
    
    console.log(`✅ Migration table cleared successfully!`);
    console.log(`Transaction ID: ${result.transaction_id}`);
    console.log(`🔗 View on explorer: https://explorer.telos.net/transaction/${result.transaction_id}`);
    
  } catch (error) {
    console.error('❌ Clear operation failed:', error.message);
    if (error.json) {
      console.error('Error details:', JSON.stringify(error.json, null, 2));
    }
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log('⚠️  WARNING: This will clear ALL entries from the migration table!');
  console.log(`Contract: ${CONTRACT_ACCOUNT}`);
  console.log('\n❗ This action will remove all migration data including:');
  console.log('   - All whitelisted accounts');
  console.log('   - All migration records');
  console.log('   - All ethereum addresses');
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('\nAre you sure you want to clear the entire migration table? (yes/no): ', async (answer) => {
    readline.close();
    
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      await clearMigrationTable();
    } else {
      console.log('Clear operation cancelled.');
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