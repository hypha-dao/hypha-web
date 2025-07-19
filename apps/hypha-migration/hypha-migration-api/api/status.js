const BlockchainService = require('./utils/blockchain');

// Initialize blockchain service
const blockchainService = new BlockchainService();

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    if (req.method === 'GET') {
      // GET request - check if we have query parameters
      const { telosAccount, ethAddress } = req.query;
      
      if (!telosAccount || !ethAddress) {
        return res.status(400).json({
          error: 'Missing required parameters',
          message: 'telosAccount and ethAddress query parameters are required'
        });
      }

      return handleStatusCheck(telosAccount, ethAddress, res);
    } 
    
    if (req.method === 'POST') {
      // POST request - check body
      const { telosAccount, ethAddress } = req.body;
      
      if (!telosAccount || !ethAddress) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'telosAccount and ethAddress are required in request body'
        });
      }

      return handleStatusCheck(telosAccount, ethAddress, res);
    }

    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only GET and POST requests are supported'
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

async function handleStatusCheck(telosAccount, ethAddress, res) {
  try {
    // Validate Ethereum address format
    if (!blockchainService.isValidAddress(ethAddress)) {
      return res.status(400).json({
        error: 'Invalid address',
        message: 'Invalid Ethereum address format'
      });
    }

    console.log(`Status check: ${telosAccount} -> ${ethAddress}`);

    // Check migration status
    let migrationStatus;
    try {
      migrationStatus = await blockchainService.verifyMigrationStatus(telosAccount, ethAddress);
      console.log('Migration status:', migrationStatus);
    } catch (error) {
      console.error('Migration verification failed:', error);
      return res.status(200).json({
        success: false,
        migrationVerified: false,
        error: error.message,
        data: {
          telosAccount,
          ethAddress,
          eligibleForTransfer: false
        }
      });
    }

    // Success response
    return res.status(200).json({
      success: true,
      migrationVerified: true,
      message: 'Migration verified successfully',
      data: {
        migration: migrationStatus,
        telosAccount,
        ethAddress,
        eligibleForTransfer: true
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json({
      error: 'Status check failed',
      message: error.message
    });
  }
} 