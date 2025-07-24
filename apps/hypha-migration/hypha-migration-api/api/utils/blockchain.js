const { ethers } = require('ethers');
const axios = require('axios');

// Base Mainnet configuration
const BASE_RPC_URL = 'https://mainnet.base.org';
const BASE_CHAIN_ID = 8453;

// HYPHA contract on Base Mainnet
const HYPHA_CONTRACT_ADDRESS = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';
const HYPHA_ABI = [
  {
    "inputs": [
      {"name": "to", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "name": "mint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "type": "function"
  }
];

// Telos configuration for migration verification
const TELOS_RPC_URL = 'https://mainnet.telos.net';
const MIGRATION_CONTRACT = 'migratehypha';

// Helper function to convert BigInt values to strings for JSON serialization
function serializeBigInt(obj) {
  return JSON.parse(JSON.stringify(obj, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  ));
}

// Helper function to convert HYPHA amount from Telos format to 18 decimals
function convertHyphaAmount(telosAmount) {
  // telosAmount is like "10.0000 HYPHA"
  // Extract the numeric part and convert to 18 decimals
  const amountStr = telosAmount.split(' ')[0]; // "10.0000"
  const amount = parseFloat(amountStr); // 10.0000
  
  // Convert to 18 decimals: 10 HYPHA = 10 * 10^18
  return ethers.parseUnits(amount.toString(), 18);
}

class BlockchainService {
  constructor() {
    this.baseProvider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    this.wallet = null;
    this.hyphaContract = null;
    
    if (process.env.PRIVATE_KEY) {
      this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.baseProvider);
      this.hyphaContract = new ethers.Contract(HYPHA_CONTRACT_ADDRESS, HYPHA_ABI, this.wallet);
    }
  }

  // Verify migration status on Telos blockchain
  async verifyMigrationStatus(telosAccount, ethAddress) {
    try {
      console.log(`Verifying migration for ${telosAccount} -> ${ethAddress}`);
      
      const response = await axios.post(`${TELOS_RPC_URL}/v1/chain/get_table_rows`, {
        code: MIGRATION_CONTRACT,
        scope: MIGRATION_CONTRACT,
        table: 'migrations',
        lower_bound: telosAccount,
        upper_bound: telosAccount,
        limit: 1,
        key_type: 'name',
        json: true
      });

      if (!response.data.rows || response.data.rows.length === 0) {
        throw new Error('Account not found in migration table');
      }

      const migrationEntry = response.data.rows[0];
      console.log('Migration entry:', migrationEntry);

      // Extract data based on structure
      let accountName, amountValue, ethAddr, migrated;
      
      if (Array.isArray(migrationEntry) || (typeof migrationEntry === 'object' && Object.keys(migrationEntry)[0] === '0')) {
        accountName = migrationEntry[0] || migrationEntry['0'];
        amountValue = migrationEntry[1] || migrationEntry['1'];
        ethAddr = migrationEntry[2] || migrationEntry['2'];
        migrated = migrationEntry[3] || migrationEntry['3'];
      } else {
        accountName = migrationEntry.account;
        amountValue = migrationEntry.amount;
        ethAddr = migrationEntry.eth_address;
        migrated = migrationEntry.migrated;
      }

      console.log('Extracted data:', { accountName, amountValue, ethAddr, migrated });

      // Verify the account matches
      if (accountName !== telosAccount) {
        throw new Error('Account name mismatch');
      }

      // Verify the migration is completed
      if (!migrated) {
        throw new Error('Migration not completed yet');
      }

      // Verify the Ethereum address matches (case insensitive)
      if (ethAddr.toLowerCase() !== ethAddress.toLowerCase()) {
        throw new Error('Ethereum address mismatch');
      }

      // Handle amount format - it could be a string like "100.0000 HYPHA" or an object
      let amountDisplay = amountValue;
      if (typeof amountValue === 'object' && amountValue !== null) {
        amountDisplay = amountValue.quantity || amountValue.toString() || JSON.stringify(amountValue);
      } else if (typeof amountValue === 'string') {
        amountDisplay = amountValue;
      } else if (amountValue === undefined || amountValue === null) {
        amountDisplay = '0.0000 HYPHA';
      } else {
        amountDisplay = `${amountValue} HYPHA`;
      }

      return {
        verified: true,
        account: accountName,
        amount: amountDisplay,
        ethAddress: ethAddr,
        migrated: migrated
      };

    } catch (error) {
      console.error('Migration verification error:', error);
      throw error;
    }
  }

  // Verify transaction success by transaction ID
  async verifyTransactionSuccess(transactionId, expectedAccount, expectedEthAddress) {
    try {
      console.log(`Verifying transaction: ${transactionId}`);
      
      const response = await axios.post(`${TELOS_RPC_URL}/v1/history/get_transaction`, {
        id: transactionId
      });

      if (!response.data || !response.data.trx) {
        throw new Error('Transaction not found');
      }

      const transaction = response.data.trx;
      
      // Debug: Log the entire transaction structure
      console.log('Full transaction structure:', JSON.stringify(transaction, null, 2));
      
      // Check if transaction was successful
      if (!transaction.receipt || transaction.receipt.status !== 'executed') {
        throw new Error('Transaction was not executed successfully');
      }

      // Check if this is a migration transaction
      console.log('Looking for migration actions...');
      console.log('Transaction.trx:', JSON.stringify(transaction.trx, null, 2));
      
      const actions = transaction.trx?.actions || transaction.actions || [];
      console.log('Found actions:', JSON.stringify(actions, null, 2));
      console.log('Expected contract:', MIGRATION_CONTRACT);
      
      const migrationAction = actions.find(action => {
        console.log(`Checking action: ${action.account} === ${MIGRATION_CONTRACT} && ${action.name} === 'migrate'`);
        return action.account === MIGRATION_CONTRACT && action.name === 'migrate';
      });

      if (!migrationAction) {
        console.log('Available actions in transaction:');
        actions.forEach((action, index) => {
          console.log(`  Action ${index}: account=${action.account}, name=${action.name}`);
        });
        throw new Error('No migration action found in transaction');
      }

      // Verify the action data matches expected values
      const actionData = migrationAction.data;
      if (actionData.user !== expectedAccount) {
        throw new Error('Transaction account mismatch');
      }

      if (actionData.eth_address.toLowerCase() !== expectedEthAddress.toLowerCase()) {
        throw new Error('Transaction Ethereum address mismatch');
      }

      return {
        verified: true,
        transactionId: transactionId,
        account: actionData.user,
        ethAddress: actionData.eth_address,
        blockNumber: transaction.block_num,
        blockTime: transaction.block_time
      };

    } catch (error) {
      console.error('Transaction verification error:', error);
      throw error;
    }
  }

  // Get HYPHA balance with improved error handling
  async getHyphaBalance(address) {
    try {
      if (!this.hyphaContract) {
        throw new Error('HYPHA contract not initialized');
      }

      console.log(`Getting HYPHA balance for: ${address}`);

      // Get balance and decimals with proper error handling
      const [balance, decimals] = await Promise.allSettled([
        this.hyphaContract.balanceOf(address),
        this.hyphaContract.decimals()
      ]);

      if (balance.status === 'rejected') {
        console.error('Balance query failed:', balance.reason);
        throw new Error(`Failed to get balance: ${balance.reason.message || balance.reason}`);
      }

      if (decimals.status === 'rejected') {
        console.error('Decimals query failed:', decimals.reason);
        // Default to 18 decimals for HYPHA if decimals call fails
        const decimalsValue = 18;
        const balanceFormatted = ethers.formatUnits(balance.value, decimalsValue);
        
        return {
          balance: balance.value.toString(),
          formatted: balanceFormatted,
          decimals: decimalsValue
        };
      }

      const balanceFormatted = ethers.formatUnits(balance.value, decimals.value);
      
      return {
        balance: balance.value.toString(),
        formatted: balanceFormatted,
        decimals: Number(decimals.value)
      };

    } catch (error) {
      console.error('Error getting HYPHA balance:', error);
      throw error;
    }
  }

  // Mint HYPHA tokens with migration verification
  async mintHypha(telosAccount, ethAddress) {
    try {
      if (!this.wallet || !this.hyphaContract) {
        throw new Error('Wallet or HYPHA contract not initialized');
      }

      // First verify the migration and get the amount
      const migrationData = await this.verifyMigrationStatus(telosAccount, ethAddress);
      console.log(`Minting HYPHA for verified migration: ${migrationData.amount} to ${ethAddress}`);

      // Convert amount to proper units (HYPHA has 18 decimals)
      const amountInUnits = convertHyphaAmount(migrationData.amount);
      console.log(`Amount in units: ${amountInUnits.toString()}`);

      // Estimate gas
      const gasEstimate = await this.hyphaContract.mint.estimateGas(ethAddress, amountInUnits);
      console.log(`Gas estimate: ${gasEstimate.toString()}`);

      // Execute mint
      const tx = await this.hyphaContract.mint(ethAddress, amountInUnits, {
        gasLimit: gasEstimate + BigInt(10000) // Add some buffer
      });

      console.log(`Transaction hash: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);

      // Return serializable data (convert BigInt to string)
      return {
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        amount: migrationData.amount,
        amountInUnits: amountInUnits.toString(),
        to: ethAddress,
        from: this.wallet.address,
        migrationData: migrationData
      };

    } catch (error) {
      console.error('Error minting HYPHA:', error);
      throw error;
    }
  }

  // Get a random Base address for testing
  getRandomAddress() {
    return ethers.Wallet.createRandom().address;
  }

  // Validate Ethereum address
  isValidAddress(address) {
    return ethers.isAddress(address);
  }
}

module.exports = BlockchainService; 