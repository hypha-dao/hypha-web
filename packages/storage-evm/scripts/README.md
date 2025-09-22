## Scripts

### dao-space-factory-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/dao-space-factory-proxy.deploy.ts --network base-mainnet

npx nx run storage-evm:script ./scripts/dao-space-factory.upgrade.ts --network base-mainnet

```

### dao-proposals-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/dao-proposals-proxy.deploy.ts --network base-mainnet

npx nx run storage-evm:script ./scripts/space-payment-tracker.upgrade.ts --network base-mainnet
```

### decaying-token-factory-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/decaying-token-factory-proxy.deploy.ts --network base-mainnet
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

npx nx run storage-evm:script ./scripts/decaying-token-factory.upgrade.ts--network base-mainnet

npx nx run storage-evm:script ./scripts/ownership-token-factory.upgrade.ts--network base-mainnet

npx nx run storage-evm:script ./scripts/ownership-token-voting-power.upgrade.ts --network base-mainnet

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
npx nx run storage-evm:test ./test/DAOSpaceFactoryImplementation.inviteSystem.test.ts



# If node is in /usr/local/bin/node
export PATH="/usr/local/bin:$PATH"
# If using NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /Users/vlad/hypha-web/packages/storage-evm && REPORT_GAS=true npx hardhat test --config hardhat.local.config.ts ./test/DAOSpaceFactoryImplementation.test.ts | cat

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
npx nx run storage-evm:script ./scripts/token-voting-power.upgrade.ts --network base-mainnet
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
npx nx run storage-evm:script ./scripts/hypha-token.upgrade.ts --network base-mainnet

```

## Token Management Scripts

### Mint Tokens

Mint HYPHA tokens to a specified address (requires mint whitelist):

```bash
# Dry run to preview the mint operation
npx ts-node scripts/base-mainnet-contracts-scripts/mint-tokens.ts 0xRecipientAddress 100.5 --dry-run

# Actually mint tokens
npx ts-node scripts/base-mainnet-contracts-scripts/mint-tokens.ts 0xRecipientAddress 100.5

# Specify custom HyphaToken address
npx ts-node scripts/base-mainnet-contracts-scripts/mint-tokens.ts 0xRecipientAddress 100.5 0xHyphaTokenAddress
```

### Burn Tokens

Burn HYPHA tokens from any address (owner only, forfeits unclaimed rewards):

```bash
# Dry run to preview the burn operation
npx ts-node scripts/base-mainnet-contracts-scripts/burn-tokens.ts 0xFromAddress 50.0 --dry-run

# Actually burn tokens
npx ts-node scripts/base-mainnet-contracts-scripts/burn-tokens.ts 0xFromAddress 50.0

# Specify custom HyphaToken address
npx ts-node scripts/base-mainnet-contracts-scripts/burn-tokens.ts 0xFromAddress 50.0 0xHyphaTokenAddress
```

**Important Notes:**

- Mint requires the caller to be in the mint transfer whitelist
- Burn requires the caller to be the contract owner
- Burning tokens will **forfeit any unclaimed rewards** for the target address
- Both scripts automatically read the HyphaToken address from `contracts/addresses.txt`
