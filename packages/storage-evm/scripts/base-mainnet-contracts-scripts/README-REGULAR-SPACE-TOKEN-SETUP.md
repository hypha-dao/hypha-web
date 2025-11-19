# RegularSpaceToken Integration Setup with Proxy Upgrade

This script automates the complete setup process for upgrading and integrating the `RegularSpaceToken` proxy with the `EnergyDistribution` contract.

## Overview

The `RegularSpaceToken` at `0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a` is a UUPS upgradeable proxy. The new implementation (`energytokenupdatable.sol`) includes an authorization system similar to `EnergyToken.sol`, which allows the EnergyDistribution contract to:

- Mint tokens when needed (auto-mint on transfer to treasury)
- Burn tokens from user addresses
- Manage balances for the energy accounting system

## What This Script Does

The script `setup-regular-space-token-integration.ts` performs the following steps:

1. **Deploy New Implementation**

   - Compiles and deploys the new `RegularSpaceToken` implementation
   - Uses the `energytokenupdatable.sol` contract
   - Returns the new implementation address

2. **Upgrade Proxy**

   - Upgrades the proxy at `0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a`
   - Points it to the new implementation
   - Uses UUPS `upgradeTo()` function
   - Verifies upgrade was successful

3. **Check Token Information**

   - Verifies token details (name, symbol, decimals, owner)
   - Confirms you are the token owner
   - Ensures decimals are set to 6 (matching USDC)

4. **Authorize EnergyDistribution**

   - Grants the EnergyDistribution contract permission to mint/burn tokens
   - Uses the `setAuthorized()` function on the RegularSpaceToken
   - Verifies authorization was successful

5. **Update EnergyDistribution**

   - Sets the token address in the EnergyDistribution contract
   - Uses the `setEnergyToken()` function
   - Verifies the token was updated correctly

6. **Run Emergency Reset**

   - Clears all existing balances and energy distribution data
   - Resets the system to a clean zero-sum state
   - Ensures no leftover state from the old token

7. **Verify Complete Setup**
   - Confirms all configurations are correct
   - Verifies zero-sum property is maintained
   - Provides a final status report

## Prerequisites

- You must be the **owner** of the RegularSpaceToken contract
- You must be **whitelisted** on the EnergyDistribution contract
- You need sufficient ETH for gas fees (Base mainnet)

## Configuration

The script uses these addresses:

```typescript
const ENERGY_DISTRIBUTION_ADDRESS = '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
const NEW_REGULAR_SPACE_TOKEN_ADDRESS = '0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a';
const OLD_TOKEN_ADDRESS = '0xd8724e6609838a54F7e505679BF6818f1A3F2D40';
```

## Environment Setup

Create or update your `.env` file with:

```env
RPC_URL=https://mainnet.base.org
PRIVATE_KEY=your_private_key_here
```

Or create an `accounts.json` file:

```json
[
  {
    "privateKey": "your_private_key_without_0x",
    "address": "0xYourAddress"
  }
]
```

## Running the Script

From the `storage-evm` package directory:

```bash
# Navigate to the package directory
cd packages/storage-evm

# IMPORTANT: Compile the contract first!
npx hardhat compile

# Run the setup script
npx ts-node scripts/base-mainnet-contracts-scripts/setup-regular-space-token-integration.ts
```

**Note:** The script requires the contract to be compiled first. It reads the compiled artifact from `artifacts/contracts/energytokenupdatable.sol/RegularSpaceToken.json`.

## Expected Output

```
🔧 RegularSpaceToken Integration Setup with Upgrade
============================================================
Old token: 0xd8724e6609838a54F7e505679BF6818f1A3F2D40
Proxy address: 0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a
EnergyDistribution: 0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95

🔑 Wallet: 0xYourAddress
💰 Balance: X.XX ETH

📦 Step 1: Deploying New Implementation
============================================================
Reading compiled contract artifacts...
✅ Contract artifact loaded
Bytecode size: XXXX bytes
Deploying implementation contract...
This may take a minute...
Transaction sent: 0x...
✅ Implementation deployed at: 0x...NewImplementationAddress...

🔄 Step 2: Upgrading Proxy to New Implementation
============================================================
✅ You are the proxy owner
Current implementation: 0x...OldImplementation...
New implementation: 0x...NewImplementationAddress...
Sending upgradeTo transaction...
Transaction hash: 0x...
Waiting for confirmation...
✅ Transaction confirmed in block XXXXX
✅ Proxy upgraded successfully
✅ Implementation verification passed

📋 Step 3: Checking Token Information
============================================================
Token Name: SpaceToken
Token Symbol: SPACE
Decimals: 6 (should be 6)
Owner: 0xYourAddress
Total Supply: XXX
✅ You are the token owner

🔐 Step 4: Authorizing EnergyDistribution
============================================================
Current authorization: Not Authorized ❌
Sending setAuthorized transaction...
Transaction hash: 0x...
✅ Transaction confirmed in block XXXXX
✅ Authorization successful
✅ Verification passed

🔄 Step 5: Updating EnergyDistribution
============================================================
✅ Wallet is whitelisted
Current token: 0xd8724e6609838a54F7e505679BF6818f1A3F2D40
New token: 0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a
Sending setEnergyToken transaction...
Transaction hash: 0x...
✅ Transaction confirmed in block XXXXX
✅ Token updated successfully
✅ Verification passed

🚨 Step 6: Running Emergency Reset
============================================================
Zero-sum before reset: ❌ No
System balance: XXX
Executing emergency reset...
Transaction hash: 0x...
✅ Transaction confirmed in block XXXXX
✅ Emergency reset completed
Zero-sum after reset: ✅ Yes
System balance: 0

✅ Step 7: Verifying Complete Setup
============================================================
Token Configuration:
  Name: SpaceToken
  Decimals: 6 ✅
  Owner: 0xYourAddress
  EnergyDistribution Authorized: ✅ Yes

EnergyDistribution Configuration:
  Token Address: 0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a
  Matches New Token: ✅ Yes

System State:
  Zero-Sum Property: ✅ Maintained
  System Balance: 0

✅ All checks passed!

🎉 SUCCESS! All steps completed!
============================================================
✅ New Implementation: 0x...NewImplementationAddress...
✅ Proxy upgraded: 0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a
✅ EnergyDistribution updated
✅ Authorization configured
✅ Emergency reset completed

🚀 System is ready to use!
```

## Key Changes to RegularSpaceTokenNew.sol

The contract now includes:

1. **Authorization Mapping**

   ```solidity
   mapping(address => bool) public authorized;
   ```

2. **Authorization Functions**

   ```solidity
   function setAuthorized(address account, bool _authorized) external onlyOwner
   ```

3. **Authorized Burn Functions**

   ```solidity
   function burn(address from, uint256 amount) public onlyAuthorized
   function burnFrom(address from, uint256 amount) public override onlyAuthorized
   ```

4. **Auto-Mint Transfer**

   ```solidity
   function transfer(address to, uint256 amount) public virtual override returns (bool)
   ```

   - If an authorized contract transfers and doesn't have enough balance, it will auto-mint the difference

5. **USDC-Compatible Decimals**
   ```solidity
   function decimals() public pure override returns (uint8) {
     return 6;
   }
   ```

## Troubleshooting

### "You must be the token owner to proceed"

- Only the token owner can authorize contracts
- Check the token owner with: `await token.owner()`

### "Wallet is not whitelisted on EnergyDistribution"

- Your wallet must be whitelisted to call EnergyDistribution functions
- Contact the EnergyDistribution owner to add you to the whitelist

### "Authorization verification failed"

- The transaction may have failed
- Check the transaction on BaseScan
- Ensure you have enough gas

### Transaction Fails

- Ensure you have enough ETH for gas
- Check that you're connected to Base mainnet
- Verify the RPC URL is correct

## Next Steps

After running this script successfully:

1. The system is reset and ready for new energy distributions
2. You can start distributing energy tokens using the new RegularSpaceToken
3. All member balances have been cleared
4. The zero-sum property is maintained

## Support

For issues or questions:

- Check the transaction on [BaseScan](https://basescan.org)
- Review the EnergyDistribution contract state
- Verify token authorization status
