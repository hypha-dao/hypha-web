# DAO Proposals

## Overview

The DAO Proposals contract manages the creation, voting, and execution of proposals within DAO spaces. It supports voting power tracking and automatic execution when voting thresholds are met.

## How proposals work?

Proposals are created by a DAO members and are open for voting by all members of the DAO.

Proposals have a voting period and a quorum and unity thresholds.

Example of quorum threshold (1M1V):

If the quorum threshold is 30% and the total voting power of the DAO is 10, the threshold is met if the proposal receives 3 votes.

Example of unity threshold:

If the unity threshold is 50% and the there are 10 yes votes and 5 no votes, the unity is 10/15 (66%) hence the threshold is met.

Proposals are automatically executed if both thresholds are met.

Proposals are categorized into passed and not passed. Proposal is passed if it is executed. Proposal is not passed if it has expired. 

Once the voting period has commenced and the proposal has not been executed it can be categorized as not passed. 

## Function Summary

### Write Functions (5)

- `initialize(address initialOwner)`
- `setContracts(address _spaceFactory, address _directory)`
- `createProposal(ProposalParams memory params)`
- `vote(uint256 _proposalId, bool _support)`
- `checkProposalExpiration(uint256 _proposalId)`

### View Functions (3)

- `getProposalCore(uint256 _proposalId)`
- `getProposalEndTime(uint256 _proposalId)`
- `hasVoted(uint256 _proposalId, address _voter)`

## Key Features

- Create and manage proposals
- Dynamic voting power tracking
- Automatic proposal execution
- Proposal expiration handling
- Value transfer support

## Contract Addresses

- Mainnet: `0x...` (TBD)

## Main Functions

### createProposal

Creates a new proposal with specified parameters.

```solidity
function createProposal(ProposalParams memory params) external returns (uint256)
```

Parameters (ProposalParams struct):

- `spaceId` (uint256): ID of the space where proposal is created
- `duration` (uint256): Duration of voting period in seconds
- `targetContract` (address): Contract to execute if proposal passes
- `executionData` (bytes): Data to execute if proposal passes
- `value` (uint256): ETH value to send with execution

Returns:

- `uint256`: ID of the created proposal

### vote

Casts a vote on a proposal.

```solidity
function vote(uint256 _proposalId, bool _support) external
```

Parameters:

- `_proposalId` (uint256): ID of the proposal to vote on
- `_support` (bool): True for yes vote, false for no vote

### getProposalCore

Returns detailed information about a proposal.

```solidity
function getProposalCore(uint256 _proposalId) external view returns (
    uint256 spaceId,
    uint256 startTime,
    uint256 endTime,
    bool executed,
    bool expired,
    uint256 yesVotes,
    uint256 noVotes,
    uint256 totalVotingPowerAtSnapshot,
    address creator
)
```

## View Functions

### hasVoted

Checks if an address has voted on a proposal.

```solidity
function hasVoted(uint256 _proposalId, address _voter) external view returns (bool)
```

### getProposalEndTime

Returns the end time of a proposal's voting period.

```solidity
function getProposalEndTime(uint256 _proposalId) external view returns (uint256)
```

## Events

### ProposalCreated

```solidity
event ProposalCreated(
    uint256 indexed proposalId,
    uint256 indexed spaceId,
    uint256 startTime,
    uint256 duration,
    address creator,
    bytes executionData
);
```

### VoteCast

```solidity
event VoteCast(
    uint256 indexed proposalId,
    address indexed voter,
    bool support,
    uint256 votingPower
);
```

### ProposalExecuted

```solidity
event ProposalExecuted(
    uint256 indexed proposalId,
    bool passed,
    uint256 yesVotes,
    uint256 noVotes
);
```

## Integration Guide

### Web3.js Example

```javascript
const proposals = new web3.eth.Contract(DAOProposalsABI, PROPOSALS_ADDRESS);

// Create proposal
const params = {
  spaceId: 1,
  duration: 86400, // 1 day
  targetContract: '0x...',
  executionData: '0x...',
  value: 0,
};

await proposals.methods.createProposal(params).send({ from: userAddress });

// Vote on proposal
await proposals.methods.vote(proposalId, true).send({ from: userAddress });

// Check proposal status
const proposalCore = await proposals.methods.getProposalCore(proposalId).call();
console.log('Votes:', {
  yes: proposalCore.yesVotes,
  no: proposalCore.noVotes,
  executed: proposalCore.executed,
});
```

### Ethers.js Example

```typescript
const proposals = new ethers.Contract(PROPOSALS_ADDRESS, DAOProposalsABI, signer);

// Create proposal
const tx = await proposals.createProposal({
  spaceId: 1,
  duration: 86400,
  targetContract: targetAddress,
  executionData: data,
  value: 0,
});
await tx.wait();

// Vote on proposal
await proposals.vote(proposalId, true);

// Listen for events
proposals.on('ProposalCreated', (proposalId, spaceId, startTime, duration, creator) => {
  console.log('New proposal created:', proposalId);
});
```

## Constants

- `MIN_VOTING_DURATION`: 1 hour
- `MAX_VOTING_DURATION`: 30 days

## Security Considerations

1. Voting Power Snapshots

   - Voting power is captured at proposal creation
   - Prevents manipulation during voting period

2. Access Control

   - Only space members can create proposals and vote

3. Execution Conditions

   - Requires meeting both unity and quorum thresholds
   - Automatic execution when conditions are met
