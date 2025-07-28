const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const fetch = require('node-fetch');
const { TextEncoder, TextDecoder } = require('util');
const fs = require('fs');

// Configuration - UPDATE THESE VALUES
const TELOS_MAINNET_RPC = 'https://mainnet.telos.net';
const CONTRACT_ACCOUNT = 'migratehypha'; // Replace with your contract account
const PRIVATE_KEY = 'x'; // Replace with contract owner's private key
const TOKEN_SYMBOL = 'HYPHA'; // Replace with your token symbol
const TOKEN_PRECISION = 4; // Replace with your token precision

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

// Helper function to validate EOS account names
function validateAccountName(accountName) {
  // EOS account name rules:
  // - Must be 12 characters or less (or 13 if last char is 1-5 or a-j)
  // - Can only contain: .12345abcdefghijklmnopqrstuvwxyz
  // - Cannot start or end with a dot
  
  if (!accountName || typeof accountName !== 'string') {
    return { valid: false, reason: 'Account name is empty or not a string' };
  }
  
  if (accountName.length > 13) {
    return { valid: false, reason: 'Account name is longer than 13 characters' };
  }
  
  if (accountName.length === 13) {
    const lastChar = accountName[12];
    if (!'12345abcdefghij'.includes(lastChar)) {
      return { valid: false, reason: 'If 13 characters, last character must be 1-5 or a-j' };
    }
  }
  
  if (accountName.startsWith('.') || accountName.endsWith('.')) {
    return { valid: false, reason: 'Account name cannot start or end with a dot' };
  }
  
  const validChars = '.12345abcdefghijklmnopqrstuvwxyz';
  for (let char of accountName) {
    if (!validChars.includes(char)) {
      return { valid: false, reason: `Invalid character '${char}' - only .12345abcdefghijklmnopqrstuvwxyz allowed` };
    }
  }
  
  return { valid: true, reason: 'Valid account name' };
}

// Modified function to validate accounts before processing
function readAccountsAndAmounts() {
  try {
    const accounts = fs.readFileSync('accs.txt', 'utf8')
      .trim()
      .split('\n')
      .filter(account => account.trim() !== '')
      .map(account => account.trim());
    
    const amounts = fs.readFileSync('amounts.txt', 'utf8')
      .trim()
      .split('\n')
      .filter(amount => amount.trim() !== '')
      .map(amount => formatAsset(amount.replace(/,/g, ''))); // Remove commas from amounts
    
    if (accounts.length !== amounts.length) {
      throw new Error(`Mismatch: ${accounts.length} accounts but ${amounts.length} amounts`);
    }
    
    // Validate all account names
    console.log('\n🔍 Validating account names...');
    const invalidAccounts = [];
    
    accounts.forEach((account, index) => {
      const validation = validateAccountName(account);
      if (!validation.valid) {
        invalidAccounts.push({
          index: index + 1,
          account: account,
          amount: amounts[index],
          reason: validation.reason
        });
      }
    });
    
    if (invalidAccounts.length > 0) {
      console.error(`\n❌ Found ${invalidAccounts.length} invalid account names:`);
      console.error('================================================');
      invalidAccounts.forEach(invalid => {
        console.error(`Line ${invalid.index}: "${invalid.account}" (${invalid.amount})`);
        console.error(`  Reason: ${invalid.reason}\n`);
      });
      
      console.error('Please fix these account names in accs.txt before proceeding.');
      process.exit(1);
    }
    
    console.log(`✅ All ${accounts.length} account names are valid!`);
    console.log(`Loaded ${accounts.length} accounts and ${amounts.length} amounts`);
    return { accounts, amounts };
  } catch (error) {
    console.error('Error reading files:', error.message);
    process.exit(1);
  }
}

// Populate migration table in batches
async function populateMigrationTable() {
  try {
    const { accounts, amounts } = readAccountsAndAmounts();
    
    // Process in batches to avoid transaction size limits
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(accounts.length / BATCH_SIZE);
    
    console.log(`Processing ${accounts.length} entries in ${totalBatches} batches of ${BATCH_SIZE}`);
    
    for (let i = 0; i < totalBatches; i++) {
      const startIdx = i * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, accounts.length);
      
      const batchAccounts = accounts.slice(startIdx, endIdx);
      const batchAmounts = amounts.slice(startIdx, endIdx);
      
      console.log(`\nProcessing batch ${i + 1}/${totalBatches} (entries ${startIdx + 1}-${endIdx})`);
      
      const action = {
        account: CONTRACT_ACCOUNT,
        name: 'populate',
        authorization: [{
          actor: CONTRACT_ACCOUNT,
          permission: 'active',
        }],
        data: {
          accounts: batchAccounts,
          amounts: batchAmounts,
        },
      };
      
      try {
        const result = await api.transact(
          { actions: [action] },
          {
            blocksBehind: 3,
            expireSeconds: 30,
          }
        );
        
        console.log(`✅ Batch ${i + 1} successful. Transaction ID: ${result.transaction_id}`);
        
        // Wait a bit between batches to avoid overwhelming the network
        if (i < totalBatches - 1) {
          console.log('Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`❌ Batch ${i + 1} failed:`, error.message);
        if (error.json) {
          console.error('Error details:', JSON.stringify(error.json, null, 2));
        }
        throw error;
      }
    }
    
    console.log('\n🎉 All batches completed successfully!');
    console.log(`Total entries processed: ${accounts.length}`);
    
  } catch (error) {
    console.error('Population failed:', error.message);
    process.exit(1);
  }
}

// Preview data before processing
function previewData() {
  const { accounts, amounts } = readAccountsAndAmounts();
  
  console.log('\n📋 DATA PREVIEW:');
  console.log('First 5 entries:');
  for (let i = 0; i < Math.min(5, accounts.length); i++) {
    console.log(`  ${i + 1}. ${accounts[i]} -> ${amounts[i]}`);
  }
  
  if (accounts.length > 5) {
    console.log('  ...');
    console.log(`  ${accounts.length}. ${accounts[accounts.length - 1]} -> ${amounts[amounts.length - 1]}`);
  }
  
  console.log(`\nTotal entries: ${accounts.length}`);
}

// Main execution
async function main() {
  console.log('🚀 Migration Table Population Script');
  console.log('====================================');
  
  // Validate configuration
  if (CONTRACT_ACCOUNT === 'your.contract' || PRIVATE_KEY === 'your_private_key') {
    console.error('❌ Please update the configuration values at the top of this script!');
    console.log('You need to set:');
    console.log('- CONTRACT_ACCOUNT: Your deployed contract account name');
    console.log('- PRIVATE_KEY: The private key of the contract owner');
    console.log('- TOKEN_SYMBOL: Your token symbol (e.g., SEEDS)');
    console.log('- TOKEN_PRECISION: Your token precision (e.g., 4)');
    process.exit(1);
  }
  
  // Preview the data
  previewData();
  
  // Ask for confirmation
  console.log('\n⚠️  WARNING: This will populate the migration table on Telos Mainnet!');
  console.log('Make sure your contract is deployed and the configuration is correct.');
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('\nDo you want to proceed? (yes/no): ', async (answer) => {
    readline.close();
    
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      await populateMigrationTable();
    } else {
      console.log('Operation cancelled.');
    }
  });
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
} 