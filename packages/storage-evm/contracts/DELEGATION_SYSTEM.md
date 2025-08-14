# Voting Power Delegation System

## Overview

This delegation system allows members to delegate their voting power to other addresses across all three voting power types:

- Token-based voting power (`TokenVotingPowerImplementation`)
- Decaying token voting power (`VoteDecayTokenVotingPowerImplementation`)
- Space membership voting power (`SpaceVotingPowerImplementation`)

## Architecture

### Core Components

1. **`IVotingPowerDelegation`** - Interface defining delegation contract API
2. **`VotingPowerDelegationStorage`** - Storage contract with delegation data structures
3. **`VotingPowerDelegationImplementation`** - Implementation contract with delegation logic
4. **Updated Voting Power Contracts** - Modified to integrate with the delegation contract

### Key Design Principles

- **Separation of Concerns**: Delegation logic is isolated in separate contracts
- **No Code Duplication**: All voting power contracts use the same delegation contract
- **Backward Compatibility**: Existing voting power functionality remains unchanged
- **Space-Specific Delegation**: Users can delegate differently for each space
- **Consistent Architecture**: Follows the same interface/storage/implementation pattern as other contracts

## How It Works

### Delegation Process

1. **Delegate**: User calls `VotingPowerDelegationImplementation.delegate(delegateAddress, spaceId)`
2. **Query Voting Power**: Voting power contracts check delegation status and aggregate power
3. **Undelegate**: User calls `VotingPowerDelegationImplementation.undelegate(spaceId)` to reclaim their power

### Voting Power Calculation

When `getVotingPower(user, spaceId)` is called:

1. **Own Power**: If user hasn't delegated, include their own voting power
2. **Delegated Power**: Add voting power from all users who delegated to this user
3. **Return Total**: Sum of own power (if not delegated) + all delegated power

### Example Scenarios

**Token-Based Voting:**

- Alice has 100 tokens, delegates to Bob
- Carol has 50 tokens, delegates to Bob
- Bob has 75 tokens
- Bob's total voting power = 75 + 100 + 50 = 225 tokens

**Space Membership Voting:**

- Alice is a member, delegates to Bob
- Carol is a member, delegates to Bob
- Bob is a member
- Bob's total voting power = 1 + 1 + 1 = 3 votes

## Integration Steps

### 1. Deploy Delegation Contract

```solidity
VotingPowerDelegationImplementation delegation = new VotingPowerDelegationImplementation();
delegation.initialize(owner);
```

### 2. Connect Voting Power Contracts

```solidity
tokenVotingPower.setDelegationContract(address(delegation));
decayVotingPower.setDelegationContract(address(delegation));
spaceVotingPower.setDelegationContract(address(delegation));
```

### 3. Users Can Delegate

```solidity
// Delegate voting power in space 1 to another address
delegation.delegate(delegateAddress, 1);

// Remove delegation
delegation.undelegate(1);
```

## Contract Files

### Interface

- `contracts/interfaces/IVotingPowerDelegation.sol` - Defines the delegation contract API

### Storage

- `contracts/storage/VotingPowerDelegationStorage.sol` - Contains delegation data mappings

### Implementation

- `contracts/VotingPowerDelegationImplementation.sol` - Core delegation logic and functionality

## API Reference

### IVotingPowerDelegation Interface

- `delegate(address _delegate, uint256 _spaceId)` - Delegate voting power
- `undelegate(uint256 _spaceId)` - Remove delegation
- `getDelegate(address _user, uint256 _spaceId) returns (address)` - Get delegate
- `getDelegators(address _delegate, uint256 _spaceId) returns (address[])` - Get delegators
- `isDelegated(address _user, uint256 _spaceId) returns (bool)` - Check delegation status
- `hasDelegated(address _user, uint256 _spaceId) returns (bool)` - Alias for isDelegated
- `getDelegationInfo(address _user, uint256 _spaceId) returns (address, bool)` - Get delegation info

### Enhanced Voting Power Contracts

All voting power contracts now have:

- `getVotingPower(address _user, uint256 _sourceSpaceId)` - Total power (own + delegated)
- `getOwnVotingPower(address _user, uint256 _sourceSpaceId)` - Only own power
- `setDelegationContract(address _delegationContract)` - Set delegation contract

## Security Considerations

- **No Self-Delegation**: Users cannot delegate to themselves
- **Single Delegation**: Each user can only delegate to one address per space
- **Owner Control**: Only contract owner can set delegation contract addresses
- **Re-entrancy Protection**: Decay token operations are protected against re-entrancy
- **Authorized Contracts**: Optional authorization system for voting power contracts

## Events

- `VotingPowerDelegated(delegator, delegate, spaceId)` - When delegation is created
- `VotingPowerUndelegated(delegator, previousDelegate, spaceId)` - When delegation is removed
- `DelegationContractSet(delegationContract)` - When voting power contracts are linked
- `VotingPowerContractAuthorized(votingPowerContract, authorized)` - When contracts are authorized
