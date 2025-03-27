# Join Method Directory Implementation

## MVP Join System Overview

For our Minimum Viable Product (MVP), we will implement a simple proposal-based invitation system:

1. A user navigates to a space they want to join
2. The user clicks "Join Space" button
3. This action automatically generates a proposal within that space
4. Existing space members vote on whether to accept the new member
5. If the proposal passes (meets quorum and unity thresholds), the user is automatically added as a member
6. If the proposal fails or expires, the join request is rejected

This approach ensures that all new memberships are explicitly approved by existing members through the governance process, maintaining the integrity and autonomy of each space.

## Contract Purpose

The `JoinMethodDirectoryImplementation` contract serves as a registry and router for different joining mechanisms that spaces can use. It allows:

- Registration of multiple join method implementations
- Selection of appropriate join method for each space
- Verification of membership eligibility

## Key Features

- Multiple join methods support
- Pluggable architecture for easy extension
- Permission checks for join eligibility
- Integration with DAO Space Factory

## Contract Interface

The contract implements the `IJoinMethodDirectory` interface and provides methods to:

1. Add new join methods to the registry
2. Remove existing join methods
3. Check if a user can join a specific space using its configured join method

## Function Summary

### Administrative Functions

- `initialize(address initialOwner)`: Set up the contract with initial owner
- `setSpaceFactory(address _spaceFactory)`: Configure the DAO Space Factory address
- `addJoinMethod(uint256 _methodId, address _implementation)`: Register a new join method implementation
- `removeJoinMethod(uint256 _methodId)`: Remove a join method from the registry

### User-Facing Functions

- `joincheck(uint256 _spaceId, uint256 _joinMethod, address _userAddress)`: Check if a user can join a specific space

## Join Method IDs

Join methods are identified by unique IDs:

- ID 1: Proposal-based join (MVP method)
- ID 2: Token-gated join
- ID 3: Allow-list based join
- ID 4: Open join (anyone can join)

## Integration Guide

### Adding a New Join Method

```solidity
// Deploy the join method implementation
JoinByProposalImplementation proposalJoin = new JoinByProposalImplementation();

// Register it with the directory
joinMethodDirectory.addJoinMethod(1, address(proposalJoin));
```

### Checking Join Eligibility

```solidity
// Check if a user can join a space
bool canJoin = joinMethodDirectory.joincheck(spaceId, joinMethodId, userAddress);
```

### Creating a Join Proposal (Frontend)

```javascript
// When user clicks "Join Space" button
async function requestToJoin(spaceId) {
  // Create proposal parameters for member addition
  const params = {
    spaceId: spaceId,
    duration: 7 * 24 * 60 * 60, // 1 week voting period
    targetContract: SPACE_FACTORY_ADDRESS,
    executionData: spaceFactory.interface.encodeFunctionData("addMember", [spaceId, userAddress]),
    value: 0
  };
  
  // Submit the proposal
  const tx = await proposalsContract.createProposal(params);
  await tx.wait();
  
  return "Join request submitted for voting";
}
```

## Development and Extension

To implement a new join method:

1. Create a contract that implements the `IJoinMethod` interface
2. Implement the `checkJoin` function with your custom logic
3. Register your implementation using `addJoinMethod`

## Security Considerations

1. Access Control
   - Only owner can add or remove join methods
   - Each space configures which join method it uses

2. Integration Checks
   - Verify that join method implementations are compatible
   - Test integration with proposal system thoroughly

3. User Experience
   - Provide clear feedback about join status
   - Notify users when their join proposal passes or fails 