const BlockchainService = require('./utils/blockchain');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Set CORS headers
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({
        error: 'Method not allowed',
        message: 'Only GET requests are supported'
      });
    }

    // Check environment variables
    const envChecks = {
      PRIVATE_KEY: !!process.env.PRIVATE_KEY,
      NODE_ENV: process.env.NODE_ENV || 'development'
    };

    // Initialize blockchain service for testing
    const blockchainService = new BlockchainService();
    
    let walletAddress = null;
    let walletConfigured = false;

    try {
      if (process.env.PRIVATE_KEY) {
        const { ethers } = require('ethers');
        walletAddress = new ethers.Wallet(process.env.PRIVATE_KEY).address;
        walletConfigured = true;
      }
    } catch (error) {
      console.log('Wallet configuration error:', error.message);
    }

    // Get wallet balance if configured
    let balanceInfo = null;
    if (walletConfigured && walletAddress) {
      try {
        balanceInfo = await blockchainService.getHyphaBalance(walletAddress);
      } catch (error) {
        console.error('Failed to get HYPHA balance:', error);
        balanceInfo = { error: error.message };
      }
    }

    // Test Base network connectivity
    let baseNetworkStatus = 'unknown';
    try {
      const network = await blockchainService.baseProvider.getNetwork();
      baseNetworkStatus = `connected (chainId: ${network.chainId})`;
    } catch (error) {
      baseNetworkStatus = `error: ${error.message}`;
    }

    // Test Telos network connectivity
    let telosNetworkStatus = 'unknown';
    try {
      const axios = require('axios');
      const response = await axios.post('https://mainnet.telos.net/v1/chain/get_info', {}, {
        timeout: 5000
      });
      telosNetworkStatus = `connected (head_block: ${response.data.head_block_num})`;
    } catch (error) {
      telosNetworkStatus = `error: ${error.message}`;
    }

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: envChecks.NODE_ENV,
      services: {
        api: 'operational',
        baseNetwork: baseNetworkStatus,
        telosNetwork: telosNetworkStatus
      },
      configuration: {
        walletConfigured,
        walletAddress: walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : null,
        environmentVariables: envChecks
      },
      endpoints: {
        '/api/health': 'GET - Health check',
        '/api/status': 'GET/POST - Check migration status',
        '/api/transfer-hybrid': 'POST - Execute HYPHA mint (migration table verification)'
      }
    };

    if (balanceInfo) {
      healthData.wallet = {
        address: walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : null,
        hyphaBalance: balanceInfo.error ? { error: balanceInfo.error } : {
          balance: balanceInfo.formatted,
          decimals: balanceInfo.decimals
        }
      };
    }

    return res.status(200).json(healthData);

  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}; 