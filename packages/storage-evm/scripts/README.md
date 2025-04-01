## Scripts

### dao-space-factory-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/dao-space-factory-proxy.deploy.ts --network base-mainnet
```

### dao-proposals-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/dao-proposals-proxy.deploy.ts --network base-mainnet
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

### token-voting-power-proxy.deploy

```bash
npx nx run storage-evm:script ./scripts/token-voting-power-proxy.deploy.ts --network base-mainnet
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
```

### Upgrade Space Factory

```bash
npx nx run storage-evm:script ./scripts/dao-space-factory.upgrade.ts --network base-mainnet
```

### Upgrade DAO Proposals

```bash
npx nx run storage-evm:script ./scripts/dao-proposals.upgrade.ts --network base-mainnet
```
