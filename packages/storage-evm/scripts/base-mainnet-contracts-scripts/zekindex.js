const { ethers } = require('ethers');

// ABI for ERC20 token mint function
const tokenABI = [
    {
        inputs: [
            { internalType: 'uint256', name: 'kwh', type: 'uint256' },
            { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
            { internalType: 'address', name: 'deviceId', type: 'address' },
        ],
        name: 'mint',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    "function decimals() view returns (uint8)"
];

module.exports = async function (context, req) {
    context.log('Token mint request received');

    try {
        // Validate request
        const deviceId = req.body?.deviceId;
        const amount = req.body?.amount;
        const timestamp = req.body?.timestamp || Math.floor(Date.now() / 1000);

        if (!deviceId || !amount) {
            context.res = {
                status: 400,
                body: { error: "Please provide both 'deviceId' and 'amount' in the request body" }
            };
            return;
        }

        // Initialize blockchain connection using environment variables
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const tokenContract = new ethers.Contract(process.env.KWH_TOKEN_ADDRESS, tokenABI, wallet);

        // Get token decimals
        const decimals = await tokenContract.decimals();
        
        // Convert amount to token units with correct decimals
        const tokenAmount = ethers.parseUnits(amount.toString(), decimals);

        // Set gas limit manually if needed
        const options = {
            gasLimit: 500000 
        };

        // Execute mint transaction with correct parameters
        const tx = await tokenContract.mint(tokenAmount, timestamp, deviceId, options);
        const receipt = await tx.wait();

        // Return success response
        context.res = {
            status: 200,
            body: {
                success: true,
                transactionHash: receipt.hash,
                deviceId: deviceId,
                amount: amount
            }
        };
    } catch (error) {
        context.log.error(`Error minting tokens: ${error.message}`);
        
        context.res = {
            status: 500,
            body: {
                error: "Failed to mint tokens",
                message: error.message
            }
        };
    }
};