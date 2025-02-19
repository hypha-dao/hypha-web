# Storage EVM Package

This package contains the Ethereum smart contracts and related infrastructure. It uses Hardhat for development and testing.

## Available Commands

Run these commands from the root of the workspace:

```shell
# Get help about available hardhat commands
nx run storage-evm:hardhat -- help

# Run tests
nx run storage-evm:test

# Run tests with gas reporting
nx run storage-evm:test -- REPORT_GAS=true

# Start a local hardhat node
nx run storage-evm:node

# Deploy contracts using Hardhat Ignition
nx run storage-evm:deploy
```

## Development

The package includes sample contracts and tests to help you get started. The main components are:

- `contracts/`: Smart contract source files
- `test/`: Contract test files
- `ignition/`: Deployment modules for Hardhat Ignition
