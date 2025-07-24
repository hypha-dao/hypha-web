#!/usr/bin/env node

/**
 * Simple test script for the Hypha Migration API
 * 
 * Usage:
 * node test-api.js [base-url] [telos-account] [eth-address]
 * 
 * Examples:
 * node test-api.js http://localhost:3000 myaccount 0x1234567890123456789012345678901234567890
 * node test-api.js https://my-app.vercel.app myaccount 0x1234567890123456789012345678901234567890
 */

const https = require('https');
const http = require('http');

// Default test values
const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_TELOS_ACCOUNT = 'testaccount';
const DEFAULT_ETH_ADDRESS = '0x742C4e7ABFC4D5e1FE6a134B83CF97CbAe9bCb00';

// Parse command line arguments
const args = process.argv.slice(2);
const baseUrl = args[0] || DEFAULT_BASE_URL;
const telosAccount = args[1] || DEFAULT_TELOS_ACCOUNT;
const ethAddress = args[2] || DEFAULT_ETH_ADDRESS;

console.log('🧪 Testing Hypha Migration API');
console.log('================================');
console.log(`Base URL: ${baseUrl}`);
console.log(`Telos Account: ${telosAccount}`);
console.log(`Eth Address: ${ethAddress}`);
console.log('');

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestLib = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = requestLib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            headers: res.headers,
            data: JSON.parse(data)
          };
          resolve(response);
        } catch (err) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Test functions
async function testHealth() {
  console.log('1️⃣  Testing Health Endpoint...');
  try {
    const response = await makeRequest(`${baseUrl}/api/health`);
    console.log(`   Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log(`   ✅ API Status: ${response.data.status}`);
      console.log(`   📡 Base Network: ${response.data.services?.baseNetwork || 'unknown'}`);
      console.log(`   🔗 Telos Network: ${response.data.services?.telosNetwork || 'unknown'}`);
      console.log(`   💼 Wallet Configured: ${response.data.configuration?.walletConfigured ? 'Yes' : 'No'}`);
      
      if (response.data.wallet?.usdcBalance) {
        console.log(`   💰 USDC Balance: ${response.data.wallet.usdcBalance.balance || 'unknown'}`);
      }
    } else {
      console.log(`   ❌ Health check failed`);
      console.log(`   Response:`, JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log('');
}

async function testStatus() {
  console.log('2️⃣  Testing Status Endpoint...');
  try {
    const response = await makeRequest(`${baseUrl}/api/status`, {
      method: 'POST',
      body: {
        telosAccount,
        ethAddress
      }
    });
    
    console.log(`   Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log(`   ✅ Migration Verified: ${response.data.migrationVerified ? 'Yes' : 'No'}`);
      console.log(`   🎯 Eligible for Transfer: ${response.data.data?.eligibleForTransfer ? 'Yes' : 'No'}`);
      
      if (response.data.data?.migration) {
        console.log(`   📋 Migration Details:`);
        console.log(`      Account: ${response.data.data.migration.account}`);
        console.log(`      ETH Address: ${response.data.data.migration.ethAddress}`);
        console.log(`      Migrated: ${response.data.data.migration.migrated}`);
      }
    } else {
      console.log(`   ⚠️  Status check response:`);
      console.log(`   ${response.data.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log('');
}

async function testTransfer() {
  console.log('3️⃣  Testing Mint Endpoint...');
  try {
    const response = await makeRequest(`${baseUrl}/api/transfer-hybrid`, {
      method: 'POST',
      body: {
        telosAccount,
        ethAddress
      }
    });
    
    console.log(`   Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log(`   ✅ Mint successful!`);
      console.log(`   💰 Amount: ${response.data.data?.mint?.amount || 'unknown'} HYPHA`);
      console.log(`   📍 To: ${response.data.data?.mint?.to || 'unknown'}`);
      console.log(`   🔗 TX Hash: ${response.data.data?.mint?.txHash || 'unknown'}`);
      console.log(`   ⛽ Gas Used: ${response.data.data?.mint?.gasUsed || 'unknown'}`);
    } else {
      console.log(`   ⚠️  Mint failed:`);
      console.log(`   ${response.data.message || response.data.error || 'Unknown error'}`);
      
      if (response.data.code === 'MIGRATION_NOT_VERIFIED') {
        console.log(`   💡 Tip: This is expected if migration hasn't been completed`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log('');
}

// Run all tests
async function runTests() {
  console.log(`⏱️  Starting tests at ${new Date().toISOString()}`);
  console.log('');
  
  await testHealth();
  await testStatus();
  await testTransfer();
  
  console.log('🏁 Tests completed!');
  console.log('');
  console.log('📝 Notes:');
  console.log('   - Health endpoint should always work');
  console.log('   - Status endpoint tests migration verification');
  console.log('   - Transfer-hybrid endpoint uses migration table verification');
  console.log('   - Check Vercel logs for detailed error information');
}

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run the tests
runTests().catch((error) => {
  console.error('❌ Test runner error:', error.message);
  process.exit(1);
}); 