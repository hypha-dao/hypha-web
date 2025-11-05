# Hypha DAO Smart Contracts

This document provides an overview of the Hypha DAO smart contract architecture, intended for auditors and developers reviewing the system. It outlines the overall design, describes individual contracts, and highlights key security considerations.

## Architecture Overview

The Hypha DAO contract system is a modular and upgradable framework for creating and managing decentralized autonomous organizations (DAOs), referred to as "Spaces." The architecture is designed to be flexible, allowing for different governance models and membership criteria.

### Upgradability

The contracts are built using the **UUPS (Universal Upgradeable Proxy Standard)** pattern. Each main contract is an implementation contract that sits behind a proxy. This allows the logic of the contracts to be upgraded without requiring a data migration. The upgrade process is controlled by the owner of the contract.

### Storage Separation

To ensure safe upgrades, the contract state is kept in separate storage contracts. Logic contracts inherit from their corresponding storage contracts. This separation of logic and data is a critical safety feature for upgradable contracts.

### Core Components

The system is comprised of several key components:

- **Space Factory**: A factory contract for creating new Spaces (DAOs).
- **Proposals Module**: Manages proposal creation, voting, and execution.
- **Hypha Token**: The native ERC20 token used for payments and rewards.
- **Voting Power Modules**: A flexible system for calculating voting power based on different criteria (e.g., token holdings, reputation).
- **Join/Exit Modules**: Defines different methods for members to join or leave a Space.

## Contract Descriptions

Below is a list of the main contracts in the system, grouped by functionality.

### Core Contracts

- `DAOSpaceFactoryImplementation.sol`: The central factory for creating and managing Spaces. It handles the creation of new DAOs, member management, and configuration of various parameters like voting rules and join/exit methods.
- `DAOProposalsImplementation.sol`: Manages the lifecycle of proposals within a Space, including creation, voting, and execution. It interacts with voting power modules to determine voter weight.
- `Executor.sol`: A simple contract created for each Space that is responsible for executing the transactions associated with a passed proposal. Each Space gets its own `Executor`.
- `HyphaToken.sol`: The ERC20 token for the Hypha ecosystem. It includes mechanisms for payments, investments, and a rewards distribution system. Transfers are restricted by a whitelist.

### Voting Power Contracts

These contracts implement different strategies for calculating a user's voting power within a Space.

- `TokenVotingPowerImplementation.sol`: Voting power is based on the balance of a specific ERC20 token.
- `VoteDecayTokenVotingPowerImplementation.sol`: A variation of token-based voting where voting power decays over time.
- `OwnershipTokenVotingPowerImplementation.sol`: Voting power is based on ownership of an NFT (ERC721).
- `SpaceVotingPowerImplementation.sol`: A base contract for Space-related voting power.
- `VotingPowerDelegationImplementation.sol`: Allows users to delegate their voting power to another address.
- `VotingPowerDirectoryImplementation.sol`: A directory that maps voting power source IDs to their contract addresses.

### Token and Factory Contracts

- `OwnershipTokenFactory.sol`, `RegularTokenFactory.sol`, `DecayingTokenFactory.sol`: Factories for creating different types of tokens used within Spaces.
- `OwnershipSpaceToken.sol`, `RegularSpaceToken.sol`, `DecayingSpaceToken.sol`: The actual token contracts created by the factories.

### Membership Management

- `JoinMethodDirectoryImplementation.sol` & `ExitMethodDirectoryImplementation.sol`: Directories for different methods of joining or exiting a space.
- `JoinMethodOpenJoin.sol`: Anyone can join.
- `TokenBalanceJoinImplementation.sol` & `TokenBalanceExitImplementation.sol`: Joining or exiting is based on holding a certain token balance.
- `InviteSystemImplementation.sol`: A system for inviting new members to a space.
- `NoExit.sol`: A contract that doesn't allow members to exit.

### Other Contracts

- `SpacePaymentTracker.sol`: Tracks payments for Spaces, which is required to keep them active.
- `EscrowImplementation.sol`: A general-purpose escrow contract.
- `AgreementsImplementation.sol`: A contract for managing agreements.

### Interfaces and Storage

- The `interfaces/` directory contains the interfaces for all major contracts, defining their public functions.
- The `storage/` directory contains the storage contracts for all major contracts, defining their state variables.

## Known Vulnerabilities & Security Considerations

This section highlights known risks and areas that require special attention during an audit.

### 1. Contract Ownership and Centralization

- **Description**: Each of the main contracts (`DAOSpaceFactory`, `DAOProposals`, `HyphaToken`, etc.) is `Ownable`. The owner has powerful privileges, including the ability to upgrade the contract's implementation (`_authorizeUpgrade` is modified by `onlyOwner`).
- **Risk**: A compromised owner key could lead to a malicious upgrade of the contracts, potentially allowing the attacker to steal funds, change governance parameters, or lock the system. The ownership is a single point of failure.
- **Mitigation**: The owner key must be stored securely, ideally in a multi-sig wallet or hardware wallet. A future mitigation could be to transfer ownership to a DAO governed by HYPHA token holders.

### 2. Deployment Key Management

- **Description**: The private key for deploying and managing the contracts is stored as an environment variable in the deployment environment.
- **Risk**: Storing private keys in environment variables is risky. If the deployment server or CI/CD system is compromised, the key could be exposed. This key is used to set the initial owner of the contracts.
- **Mitigation**: Use a dedicated key management service to store and manage the deployment key. Avoid storing it directly in environment variables.

### 3. UUPS Upgrade Risks

- **Description**: The contracts use the UUPS proxy pattern. While this allows for upgradability, it also carries risks.
- **Risk**:
  - **Storage Collisions**: An upgrade to a new implementation contract could introduce new state variables that conflict with the storage layout of the previous implementation, leading to data corruption.
  - **Initialization**: The `initialize` function can be called only once. However, a faulty upgrade could potentially allow for re-initialization. The use of `_disableInitializers()` in constructors helps prevent this on implementation contracts, but care must be taken.
  - **Malicious Upgrade**: As mentioned above, the owner can upgrade to a malicious implementation.
- **Mitigation**: Follow a strict development and deployment process for upgrades, including thorough testing of storage layout compatibility using tools like `hardhat-upgrades`. Upgrades should be audited before deployment. A timelock on upgrades would provide users time to exit the system if a malicious upgrade is proposed.

### 4. Whitelist-based Transfers in `HyphaToken`

- **Description**: The `HyphaToken.sol` contract restricts token transfers to whitelisted addresses.
- **Risk**: This is a centralizing feature. If the owner (who controls the whitelist) becomes malicious or is compromised, they could prevent legitimate transfers or enable transfers for malicious actors.
- **Mitigation**: The process for managing the whitelist should be transparent and, ideally, governed by the DAO.

### 5. Complexity of the System

- **Description**: The system is composed of many interacting contracts.
- **Risk**: The high degree of complexity and interaction between contracts can lead to emergent vulnerabilities that are not apparent when looking at contracts in isolation. For example, the interplay between voting power calculation, proposal execution, and token mechanics could have unforeseen consequences.
- **Mitigation**: In addition to auditing individual contracts, a holistic review of the entire system and its economic incentives is required. Comprehensive integration testing is also crucial.
