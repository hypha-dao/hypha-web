# DAO Space Factory

## Overview

The DAO Space Factory is a smart contract that enables the creation and management of DAO spaces. Each space represents a decentralized autonomous organization with its own members, governance parameters, and token configurations.

## Function Summary

### Write Functions (5)

- `initialize(address initialOwner)`
- `setContracts(address _tokenFactoryAddress, address _joinMethodDirectoryAddress, address _exitMethodDirectoryAddress, address _proposalManagerAddress)`
- `createSpace(SpaceCreationParams memory params)`
- `joinSpace(uint256 _spaceId)`
- `removeMember(uint256 _spaceId, address _memberToRemove)`
- `addTokenToSpace(uint256 _spaceId, address _tokenAddress)`

### View Functions (8)

- `getSpaceMembers(uint256 _spaceId)`
- `hasToken(uint256 _spaceId, address _tokenAddress)`
- `getSpaceExecutor(uint256 _spaceId)`
- `isMember(uint256 _spaceId, address _userAddress)`
- `isSpaceCreator(uint256 _spaceId, address _userAddress)`
- `getSpaceDetails(uint256 _spaceId)`
- `getSpaceMemberAddresses(uint256 _spaceId)`
- `getMemberSpaces(address _memberAddress)`

## Key Features

- Create new DAO spaces
- Manage space membership
- Handle token associations
- Configure governance parameters
- Support multiple exit and join methods
- Track which spaces a member is part of

## Contract Addresses

- Mainnet: `0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9`

## Main Functions

### createSpace

Creates a new DAO space with specified parameters.

```solidity
function createSpace(SpaceCreationParams memory params) external returns (uint256)
```

Parameters (SpaceCreationParams struct):

- `unity` (uint256): Required unity percentage (1-100)
- `quorum` (uint256): Required quorum percentage (1-100)
- `votingPowerSource` (uint256): Source of voting power
- `exitMethod` (uint256): Method ID for leaving the space
- `joinMethod` (uint256): Method ID for joining the space

Returns:

- `uint256`: ID of the created space

### setContracts

Sets the addresses of various contracts that the factory interacts with.

```solidity
function setContracts(
  address _tokenFactoryAddress,
  address _joinMethodDirectoryAddress,
  address _exitMethodDirectoryAddress,
  address _proposalManagerAddress
) external
```

Parameters:

- `_tokenFactoryAddress` (address): Address of the token factory contract
- `_joinMethodDirectoryAddress` (address): Address of the join method directory
- `_exitMethodDirectoryAddress` (address): Address of the exit method directory
- `_proposalManagerAddress` (address): Address of the proposal manager contract

### joinSpace

Allows an address to join a space.

```solidity
function joinSpace(uint256 _spaceId) external
```

Parameters:

- `_spaceId` (uint256): ID of the space to join

### removeMember

Removes a member from a space.

```solidity
function removeMember(uint256 _spaceId, address _memberToRemove) external
```

Parameters:

- `_spaceId` (uint256): ID of the space
- `_memberToRemove` (address): Address of the member to remove

### addTokenToSpace

Adds a token to a space. Only callable by token factory.

```solidity
function addTokenToSpace(uint256 _spaceId, address _tokenAddress) external
```

Parameters:

- `_spaceId` (uint256): ID of the space
- `_tokenAddress` (address): Address of the token to add

## View Functions

### getSpaceDetails

Returns detailed information about a space.

```solidity
function getSpaceDetails(uint256 _spaceId) external view returns (
    uint256 unity,
    uint256 quorum,
    uint256 votingPowerSource,
    address[] memory tokenAddresses,
    address[] memory members,
    uint256 exitMethod,
    uint256 joinMethod,
    uint256 createdAt,
    address creator,
    address executor
)
```

Parameters:

- `_spaceId` (uint256): ID of the space to query

Returns:

- `unity` (uint256): Unity threshold
- `quorum` (uint256): Quorum requirement
- `votingPowerSource` (uint256): Voting power source type
- `tokenAddresses` (address[]): Array of associated token addresses
- `members` (address[]): Array of member addresses
- `exitMethod` (uint256): Exit method ID
- `joinMethod` (uint256): Join method ID
- `createdAt` (uint256): Timestamp of creation
- `creator` (address): Creator's address
- `executor` (address): Executor contract address

### isMember

Checks if an address is a member of a space.

```solidity
function isMember(uint256 _spaceId, address _userAddress) external view returns (bool)
```

Parameters:

- `_spaceId` (uint256): ID of the space
- `_userAddress` (address): Address to check

Returns:

- `bool`: True if address is a member

### getMemberSpaces

Returns all space IDs that a member is part of.

```solidity
function getMemberSpaces(address _memberAddress) external view returns (uint256[] memory)
```

Parameters:

- `_memberAddress` (address): Address of the member to query

Returns:

- `uint256[]`: Array of space IDs that the member is part of

## Events

### SpaceCreated

```solidity
event SpaceCreated(
    uint256 indexed spaceId,
    uint256 unity,
    uint256 quorum,
    uint256 votingPowerSource,
    uint256 exitMethod,
    uint256 joinMethod,
    address indexed creator,
    address indexed executor
)
```

### MemberJoined

```solidity
event MemberJoined(uint256 indexed spaceId, address indexed member)
```

### MemberRemoved

```solidity
event MemberRemoved(uint256 indexed spaceId, address indexed member)
```

## Integration Guide

### Web3.js Example

```javascript
const factory = new web3.eth.Contract(DAOSpaceFactoryABI, FACTORY_ADDRESS);

// Create space
const params = {
  unity: 51,
  quorum: 66,
  votingPowerSource: 1,
  exitMethod: 1,
  joinMethod: 1,
};

const spaceId = await factory.methods.createSpace(params).send({ from: userAddress });

// Join space
await factory.methods.joinSpace(spaceId).send({ from: userAddress });

// Get spaces a member is part of
const memberSpaces = await factory.methods.getMemberSpaces(userAddress).call();
```

### Ethers.js Example

```typescript
const factory = new ethers.Contract(FACTORY_ADDRESS, DAOSpaceFactoryABI, signer);

// Create space
const tx = await factory.createSpace({
  unity: 51,
  quorum: 66,
  votingPowerSource: 1,
  exitMethod: 1,
  joinMethod: 1,
});
const receipt = await tx.wait();
const spaceId = /* extract from event logs */;

// Get spaces a member is part of
const memberSpaces = await factory.getMemberSpaces(userAddress);
```
