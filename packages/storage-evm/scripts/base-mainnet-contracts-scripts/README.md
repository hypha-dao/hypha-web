# Base Mainnet Contract Scripts

This directory contains TypeScript scripts for configuring and interacting with smart contracts deployed on Base Mainnet.

## Purpose

These scripts are used to:

1. Configure contracts after deployment
2. Test contract functionality
3. Perform administrative operations
4. Retrieve data from contracts

## Environment Configuration

All scripts use environment variables from the `.env` file. Important variables include:

- `PRIVATE_KEY`: Private key for transaction signing
- `RPC_URL`: Base Mainnet RPC endpoint
- `DAO_SPACE_FACTORY_ADDRESS`: Address of the DAOSpaceFactory contract
- `JOIN_METHOD_DIRECTORY_ADDRESS`: Address of the JoinMethodDirectory contract
- `TEST_SPACE_ID`: ID of a space to interact with
- `JOIN_METHOD`: Method ID for join methods
- `DIRECTORY_ADDRESS`: Directory contract address

## Running the Scripts

The scripts are written in TypeScript and require `ts-node` to run them directly:

1. If you don't have ts-node installed, install it globally:

   ```
   npm install -g ts-node
   # or
   yarn global add ts-node
   ```

2. Run any script using ts-node:
   ```
   ts-node addjoinmethod.ts
   ```

## Available Scripts

### addjoinmethod.ts

Adds a join method to the JoinMethodDirectory contract.

This script calls the `addJoinMethod` function on the JoinMethodDirectory contract to register a new join method implementation. It takes a method ID and implementation address from the `.env` file.

Use this script when you need to register a new method that DAOs can use for member onboarding.

```
ts-node addjoinmethod.ts
```

### removejoinmethod.ts

Removes a join method from the JoinMethodDirectory contract.

This script calls the `removeJoinMethod` function on the JoinMethodDirectory contract to unregister an existing join method. It takes a method ID from the `.env` file.

Use this script when you need to deprecate or remove a join method from being available to DAOs.

```
ts-node removejoinmethod.ts
```

### create-space-test.ts

Tests the space creation functionality of the DAOSpaceFactory contract.

This script tests creating new DAO spaces with specified parameters (unity, quorum, voting power source, etc.). It uses test accounts from the accounts.json file and verifies that spaces are created correctly.

Use this script to test the space creation functionality or to create test spaces on the network.

```
ts-node create-space-test.ts
```

### join-space.ts

Joins an existing space as a member.

This script calls the `joinSpace` function on the DAOSpaceFactory contract to add the caller as a member of a specified space. It takes a space ID from the `.env` file and displays the before and after member lists.

Use this script when you need to join a DAO space as a member.

```
ts-node join-space.ts
```

### list-spaces.ts

Lists all spaces and their details on the network.

This script calls the `spaceCounter` and `getSpaceDetails` functions on the DAOSpaceFactory contract to retrieve information about all created spaces. It displays comprehensive details including governance parameters, members, creation date, etc.

Use this script to audit or inspect all spaces on the network.

```
ts-node list-spaces.ts
```

### set-contracts-in-spacefactory.ts

Sets contract addresses in the DAOSpaceFactory contract.

This script calls the `setContracts` function on the DAOSpaceFactory to configure its dependencies: TokenFactory, JoinMethodDirectory, ExitMethodDirectory, and ProposalManager. It takes addresses from the `.env` file.

Use this script during initial setup or when updating the contract infrastructure.

```
ts-node set-contracts-in-spacefactory.ts
```

### set-space-factory-injoinmethoddirectory.ts

Sets the SpaceFactory address in the JoinMethodDirectory contract.

This script calls the `setSpaceFactory` function on the JoinMethodDirectory contract to tell it which DAOSpaceFactory contract to interact with. It takes addresses from the `.env` file.

Use this script during initial setup or when updating the contract infrastructure.

```
ts-node set-space-factory-injoinmethoddirectory.ts
```

## Note on Security

Be careful with your private keys in the `.env` file. Never commit this file to version control. Make sure to use different keys for testing and production environments.
