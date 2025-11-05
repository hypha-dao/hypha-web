// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IVotingPowerDelegation {
  function initialize(address initialOwner) external;

  function delegate(address _delegate, uint256 _spaceId) external;

  function undelegate(uint256 _spaceId) external;

  function getDelegate(
    address _user,
    uint256 _spaceId
  ) external view returns (address);

  function getDelegators(
    address _delegate,
    uint256 _spaceId
  ) external view returns (address[] memory);

  function isDelegated(
    address _user,
    uint256 _spaceId
  ) external view returns (bool);

  function hasDelegated(
    address _user,
    uint256 _spaceId
  ) external view returns (bool);

  function getDelegationInfo(
    address _user,
    uint256 _spaceId
  ) external view returns (address delegateAddress, bool hasDelegatedStatus);

  function getDelegatesForSpace(
    uint256 _spaceId
  ) external view returns (address[] memory);

  function getSpacesForDelegate(
    address _delegate
  ) external view returns (uint256[] memory);

  // Events
  event VotingPowerDelegated(
    address indexed delegator,
    address indexed delegate,
    uint256 indexed spaceId
  );

  event VotingPowerUndelegated(
    address indexed delegator,
    address indexed previousDelegate,
    uint256 indexed spaceId
  );
}
