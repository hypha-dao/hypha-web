// QR Code Transaction Callback Service
// Replaces api-payment.hypha.earth for Hypha wallet QR signing

const { Redis } = require('@upstash/redis');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Initialize Redis client (get free instance at https://upstash.com)
// Add these environment variables in Vercel:
// - UPSTASH_REDIS_REST_URL
// - UPSTASH_REDIS_REST_TOKEN
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  // Set CORS headers
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { uid, tx_id } = req.query;

  try {
    // POST: Store transaction ID (called by mobile wallet after signing)
    if (req.method === 'POST') {
      if (!uid) {
        return res.status(400).json({ error: 'Missing uid parameter' });
      }
      
      const txId = tx_id || req.body?.tx_id;
      if (!txId) {
        return res.status(400).json({ error: 'Missing tx_id parameter' });
      }

      // Store the transaction ID with 10 minute expiry
      await redis.set(`tx:${uid}`, txId, { ex: 600 });

      console.log(`Stored transaction: uid=${uid}, tx_id=${txId}`);
      
      return res.status(200).json({ 
        success: true, 
        uid, 
        tx_id: txId,
        message: 'Transaction ID stored successfully'
      });
    }

    // GET: Retrieve transaction ID (called by web app polling)
    if (req.method === 'GET') {
      if (!uid) {
        return res.status(400).json({ error: 'Missing uid parameter' });
      }

      // Retrieve the transaction ID from Redis
      const txId = await redis.get(`tx:${uid}`);
      
      if (!txId) {
        // Return 404 if not found (web app will keep polling)
        return res.status(404).json({ error: 'Transaction not found' });
      }

      console.log(`Retrieved transaction: uid=${uid}, tx_id=${txId}`);
      
      // Return just the transaction ID as text (matching original API behavior)
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(txId);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Transaction API error:', error);
    return res.status(500).json({ error: error.message });
  }
};

