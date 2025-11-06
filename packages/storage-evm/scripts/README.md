## Scripts

## TransferHelper - Gas-Free Token Transfers

The TransferHelper contract enables gas-free token transfers through Coinbase Paymaster. Deploy once, whitelist once, use for all tokens!

### 🚀 Quick Start (3 steps, 5 minutes)

**See [QUICK_START.md](./QUICK_START.md) for the fastest way to test!**

```bash
# 1. Deploy TransferHelper
npx hardhat run scripts/deploy-transfer-helper.ts --network base

# 2. Edit scripts/test-transfer-helper-mainnet.ts
#    Update the config object with your addresses

# 3. Run test
npx hardhat run scripts/test-transfer-helper-mainnet.ts --network base
```

### 📚 Documentation

- **⚡ 3-Minute Setup**: [QUICK_START.md](./QUICK_START.md) ← **Start here!**
- **🧪 Testing Guide**: [MAINNET_TESTING_GUIDE.md](./MAINNET_TESTING_GUIDE.md)
- **🔧 Integration Guide**: [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
- **📖 Contract Docs**: [TransferHelper.docs.md](../contracts/TransferHelper.docs.md)
- **💻 Frontend Examples**: [transfer-helper-frontend-example.ts](./transfer-helper-frontend-example.ts)
- **📄 Quick Reference**: [TransferHelper.README.md](../contracts/TransferHelper.README.md)

### Key Commands

| Command                           | Description                     |
| --------------------------------- | ------------------------------- |
| `deploy-transfer-helper.ts`       | Deploy TransferHelper contract  |
| `test-transfer-helper-mainnet.ts` | Test single transfer on mainnet |
| `test-batch-transfer-mainnet.ts`  | Test batch transfers            |
| `register-token-with-helper.ts`   | Whitelist tokens with helper    |

---

## Other Scripts

### dao-space-factory-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/dao-space-factory-proxy.deploy.ts --network base-mainnet
```

### dao-proposals-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/dao-proposals-proxy.deploy.ts --network base-mainnet

npx nx run storage-evm:script ./scripts/dao-proposals-proxy.deploy.ts --network base-mainnet

```

### decaying-token-factory-proxy.deploy

decaying-space-token-proxy.deploy.ts

```bash

npx nx run storage-evm:script ./scripts/decaying-space-token-proxy.deploy.ts --network base-mainnet

npx nx run storage-evm:script ./scripts/decaying-token-factory-proxy.deploy.ts --network base-mainnet

npx nx run storage-evm:script ./scripts/decaying-token-factory.upgrade.ts --network base-mainnet

decaying-token-factory.upgrade.ts

npx nx run storage-evm:script ./scripts/energy-distribution.upgrade.ts --network base-mainnet
npx nx run storage-evm:script ./scripts/energy-token.deploy.ts --network base-mainnet

npx nx run storage-evm:script ./scripts/energy-token.manual-upgrade.ts --network base-mainnet
```

### exit-method-directory-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/exit-method-directory-proxy.deploy.ts --network base-mainnet
```

### invite-system-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/invite-system-proxy.deploy.ts --network base-mainnet
```

### join-method-directory-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/join-method-directory-proxy.deploy.ts --network base-mainnet
```

### join-method-open-join.deploy

```bash
npx nx run storage-evm:script ./scripts/join-method-open-join.deploy.ts --network base-mainnet
```

### no-exit.deploy

```bash
npx nx run storage-evm:script ./scripts/no-exit.deploy.ts --network base-mainnet
```

### regular-token-factory-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/regular-token-factory-proxy.deploy.ts --network base-mainnet
```

### space-voting-power-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/space-voting-power-proxy.deploy.ts --network base-mainnet
```

### token-balance-exit-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/token-balance-exit-proxy.deploy.ts --network base-mainnet
```

### token-balance-join-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/token-balance-join-proxy.deploy.ts --network base-mainnet
```

### token-factory-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/token-factory-proxy.deploy.ts --network base-mainnet
npx nx run storage-evm:script ./scripts/deploy-transfer-helper.ts --network base-mainnet
npx nx run storage-evm:script ./scripts/test-transfer-helper-mainnet.ts --network base-mainnet

```

### token-voting-power-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/token-voting-power-proxy.deploy.ts --network base-mainnet
```

### vote-decay-token-voting-power-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/vote-decay-token-voting-power-proxy.deploy.ts --network base-mainnet
```

### voting-power-directory-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/voting-power-directory-proxy.deploy.ts --network base-mainnet
```

### work-proposal-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/work-proposal-proxy.deploy.ts --network base-mainnet
```

### Compile

```bash
npx nx run storage-evm:compile
```

### Test

```bash
npx nx run storage-evm:test ./test/DAOSpaceFactoryImplementation.test.ts
npx nx run storage-evm:test ./test/DAOProposalsImplementation.test.ts
npx nx run storage-evm:test ./test/HyphaToken.test.ts
npx nx run storage-evm:test ./test/ProposalVotingComprehensive.test.ts
npx nx run storage-evm:test ./test/ProposalVotingComprehensive.test.ts

npx nx run storage-evm:test ./test/EnergySettlementMultiCycle.test.ts

npx nx run storage-evm:test ./test/TransferHelper.test.ts


```

### Upgrade Space Factory

```bash
npx nx run storage-evm:script ./scripts/dao-space-factory.upgrade.ts --network base-mainnet
```

### Upgrade DAO Proposals

```bash
npx nx run storage-evm:script ./scripts/dao-proposals.upgrade.ts --network base-mainnet
```

### Upgrade Token Factory

```bash
npx nx run storage-evm:script ./scripts/token-factory.upgrade.ts --network base-mainnet
```

### Upgrade Token Voting Power

```bash
npx nx run storage-evm:script ./scripts/token-voting-power.upgrade.ts --network base-mainnet
```

### Upgrade VoteDecay Voting Power

```bash
npx nx run storage-evm:script ./scripts/votedecay-voting-power.upgrade.ts --network base-mainnet
```

### Deploy Agreements Proxy

```bash
npx nx run storage-evm:script ./scripts/agreements-proxy.deploy.ts --network base-mainnet
```

## Utility Scripts

### Get Proposal Data

A utility script to fetch and display detailed information about DAO proposals, including decoded transaction call data.

#### Usage

```bash
cd packages/storage-evm/scripts/base-mainnet-contracts-scripts
```

**Get the latest proposal:**

```bash
ts-node get-proposal-data.ts
```

**Get a specific proposal by ID:**

```bash
ts-node get-proposal-data.ts id 123
# or simply
ts-node get-proposal-data.ts 123
```

**Check if a specific address has voted on a proposal:**

```bash
ts-node get-proposal-data.ts 123 0xYourAddressHere
# This will show both your wallet's vote status and the specified address's vote status
```

**Get the N most recent proposals:**

```bash
ts-node get-proposal-data.ts latest 5
```

**Get a range of proposals:**

```bash
ts-node get-proposal-data.ts range 1 10
```

#### Features

- **Proposal Details**: Shows proposal ID, space ID, status, creator, timing information
- **Voting Results**: Displays yes/no votes, participation rates, percentages
- **Voter Lists**: Lists all addresses that voted yes or no
- **Transaction Decoding**: Automatically decodes transaction call data including:
  - Function signatures (e.g., `transfer(address,uint256)`)
  - Decoded parameters with types and values
  - Value amounts in both wei and ETH
  - Support for common ERC20, governance, and DAO management functions
  - Helpful links to 4byte.directory for unknown function signatures

#### Configuration

The script requires a `.env` file in the project root with:

```
RPC_URL=<your_rpc_url>
PRIVATE_KEY=<your_private_key>
DAO_PROPOSALS_ADDRESS=<dao_proposals_contract_address>
```

Note: The script will automatically try multiple known contract addresses if `DAO_PROPOSALS_ADDRESS` is not set.
