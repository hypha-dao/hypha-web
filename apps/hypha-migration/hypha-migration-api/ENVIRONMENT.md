# Environment Configuration

This document describes the environment variables needed for the Hypha Migration API.

## Required Environment Variables

### `PRIVATE_KEY`
- **Required**: Yes
- **Description**: Private key for the wallet that will send USDC transfers on Base mainnet
- **Format**: Hexadecimal string starting with `0x`
- **Example**: `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`
- **Security**: ⚠️ **NEVER** commit this to version control or share publicly!

## Optional Environment Variables

### `WALLET_ADDRESS`
- **Required**: No (derived from `PRIVATE_KEY` if not provided)
- **Description**: The Ethereum address of the wallet
- **Format**: Ethereum address
- **Example**: `0x1234567890123456789012345678901234567890`

### `NODE_ENV`
- **Required**: No
- **Default**: `development`
- **Description**: Node.js environment setting
- **Values**: `development`, `production`, `test`

### `BASE_RPC_URL`
- **Required**: No
- **Default**: `https://mainnet.base.org`
- **Description**: RPC endpoint for Base mainnet
- **Example**: `https://base-mainnet.infura.io/v3/YOUR_PROJECT_ID`

### `TELOS_RPC_URL`
- **Required**: No
- **Default**: `https://mainnet.telos.net`
- **Description**: RPC endpoint for Telos mainnet
- **Example**: `https://mainnet.telos.net`

### `USDC_CONTRACT_ADDRESS`
- **Required**: No
- **Default**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Description**: USDC contract address on Base mainnet
- **Format**: Ethereum address

### `MIGRATION_CONTRACT`
- **Required**: No
- **Default**: `migratehypha`
- **Description**: Migration contract account name on Telos
- **Format**: EOSIO account name

## Setting Up Environment Variables

### For Local Development
Create a `.env` file in the `hypha-migration-api` directory:

```bash
# .env
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
NODE_ENV=development
```

### For Vercel Deployment
Set environment variables in your Vercel dashboard:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add each variable with appropriate values
4. Make sure to set the environment (Production, Preview, Development)

## Security Notes

1. **Private Key Security**: The private key controls a wallet with real funds. Treat it like a password.
2. **Wallet Balance**: Ensure the wallet has sufficient USDC balance for transfers.
3. **Access Control**: Consider implementing additional authentication/authorization in production.
4. **Rate Limiting**: Implement rate limiting to prevent abuse.

## Wallet Setup

1. **Create a Base Wallet**: Generate a new wallet specifically for this API
2. **Fund with USDC**: Transfer USDC to the wallet for test transfers
3. **Fund with ETH**: Ensure the wallet has ETH for gas fees
4. **Test on Testnet**: Consider testing on Base Goerli first

## Example .env File

```bash
PRIVATE_KEY=0xYOUR_ACTUAL_PRIVATE_KEY_HERE
NODE_ENV=production
```

**Remember**: Never commit the `.env` file to version control! 