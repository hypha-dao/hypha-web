// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title DAOProposalsStorage
 * @notice Storage contract for DAO proposals with upgrade-safe storage layout
 *
 * CRITICAL STORAGE LAYOUT WARNING:
 * This contract has been deployed with multiple implementations that have
 * incompatible storage layouts. Some implementations incorrectly inserted
 * targetContract and executionData fields in the middle of the ProposalCore
 * struct, breaking upgrade compatibility.
 *
 * The correct storage layout (as defined in this contract) is:
 * - spaceId @slot 0
 * - startTime @slot 1
 * - duration @slot 2
 * - executed/expired @slot 3 (packed)
 * - yesVotes @slot 4
 * - noVotes @slot 5
 * - totalVotingPowerAtSnapshot @slot 6
 * - creator @slot 7
 * - hasVoted mapping @slot 8
 * - votingPowerAtSnapshot mapping @slot 9
 * - transactions array @slot 10
 *
 * Any future fields MUST be added at the end to maintain compatibility.
 */

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '../interfaces/IDAOProposals.sol';
import '../interfaces/IExecutor.sol';
import '../interfaces/ISpacePaymentTracker.sol';
import '../interfaces/IVotingPowerDelegation.sol';

interface IDAOSpaceFactory {
  function isMember(
    uint256 _spaceId,
    address _userAddress
  ) external view returns (bool);

  function getSpaceDetails(
    uint256 _spaceId
  )
    external
    view
    returns (
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
    );

  function getSpaceExecutor(uint256 _spaceId) external view returns (address);

  function getSpaceMemberAddresses(
    uint256 _spaceId
  ) external view returns (address[] memory);
}

interface IDirectory {
  function getVotingPowerSourceContract(
    uint256 _votingPowerSourceId
  ) external view returns (address);
}

interface IVotingPowerSource {
  function getVotingPower(
    address _user,
    uint256 _sourceSpaceId
  ) external view returns (uint256);

  function getTotalVotingPower(
    uint256 _sourceSpaceId
  ) external view returns (uint256);
}

contract DAOProposalsStorage is Initializable {
  uint256 internal constant MAX_VOTING_DURATION = 30 days;

  IDAOSpaceFactory internal spaceFactory;
  IDirectory internal directoryContract;

  uint256 public proposalCounter;

  // CRITICAL: ProposalCore storage layout must remain stable for upgrade safety
  // WARNING: NEVER insert new fields in the middle of this struct!
  // Always append new fields at the END to maintain storage slot compatibility
  // Some deployed implementations incorrectly inserted targetContract/executionData
  // fields in the middle, causing storage layout conflicts during upgrades.
  struct ProposalCore {
    uint256 spaceId; // slot 0
    uint256 startTime; // slot 1
    uint256 duration; // slot 2
    bool executed; // slot 3 (packed with expired)
    bool expired; // slot 3 (packed with executed)
    uint256 yesVotes; // slot 4
    uint256 noVotes; // slot 5
    uint256 totalVotingPowerAtSnapshot; // slot 6
    address creator; // slot 7
    mapping(address => bool) hasVoted; // slot 8
    mapping(address => uint256) votingPowerAtSnapshot; // slot 9
    // Field to store multiple transactions
    IDAOProposals.Transaction[] transactions; // slot 10

    // IMPORTANT: Any future fields MUST be added here at the end, never in the middle!
    // This ensures upgrade compatibility with existing deployed contracts.
  }

  mapping(uint256 => ProposalCore) internal proposalsCoreData;
  // This can be removed if all values are stored in the transactions
  mapping(uint256 => uint256) internal proposalValues;

  /**
   * @dev This empty reserved space is put in place to allow future versions to add new
   * variables without shifting down storage in the inheritance chain.
   */
  uint256[48] private __gap;

  // New storage variables - Add at the end
  mapping(uint256 => address) public spaceAddresses;

  // Track spaces that have activated their free trial
  mapping(uint256 => bool) public spaceTrialActivated;

  ISpacePaymentTracker public paymentTracker;

  // New storage variable to track executed proposals by space
  mapping(uint256 => uint256[]) internal spaceExecutedProposals;

  // New storage variable to track all executed proposals
  uint256[] internal allExecutedProposals;

  // New storage variables to track accepted and rejected proposals by space
  mapping(uint256 => uint256[]) internal spaceAcceptedProposals;
  mapping(uint256 => uint256[]) internal spaceRejectedProposals;

  // New storage variables to track voter addresses
  mapping(uint256 => address[]) public proposalYesVoters;
  mapping(uint256 => address[]) public proposalNoVoters;

  // Minimum proposal duration for a space
  mapping(uint256 => uint256) public spaceMinProposalDuration;
  IVotingPowerDelegation internal delegationContract;
}
