// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/SpaceVotingPowerStorage.sol';
import './interfaces/ISpaceVotingPower.sol';

/**
 * @title SpaceVotingPower
 * @dev Manages voting power calculations based on dynamic space membership with delegation support
 */
contract SpaceVotingPowerImplementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  SpaceVotingPowerStorage,
  ISpaceVotingPower
{
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address initialOwner) public initializer {
    __Ownable_init(initialOwner);
    __UUPSUpgradeable_init();
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  /**
   * @dev Set the delegation contract address
   * @param _delegationContract Address of the delegation contract
   */
  function setDelegationContract(
    address _delegationContract
  ) external onlyOwner {
    require(
      _delegationContract != address(0),
      'Delegation contract cannot be zero address'
    );
    delegationContract = IVotingPowerDelegation(_delegationContract);
    emit DelegationContractSet(_delegationContract);
  }

  /**
   * @dev Set the space factory contract address
   * @param _spaceFactory The address of the space factory contract
   */
  function setSpaceFactory(address _spaceFactory) external override onlyOwner {
    require(_spaceFactory != address(0), 'Invalid factory address');
    spaceFactory = IDAOSpaceFactory(_spaceFactory);
    emit SpaceFactoryUpdated(_spaceFactory);
  }

  /**
   * @dev Get voting power for a user from a specific source space (including delegated power)
   * @param _user The address to check voting power for
   * @param _sourceSpaceId The space ID from which to derive voting power
   * @return The voting power (1 if member + delegated members, 0 if not)
   */
  function getVotingPower(
    address _user,
    uint256 _sourceSpaceId
  ) external view override returns (uint256) {
    require(address(spaceFactory) != address(0), 'Space factory not set');
    require(_sourceSpaceId > 0, 'Invalid source space ID');

    uint256 totalPower = 0;

    // Add user's own power if not delegated or no delegation contract set (1 if member, 0 if not)
    if (
      address(delegationContract) == address(0) ||
      !delegationContract.hasDelegated(_user, _sourceSpaceId)
    ) {
      totalPower += _getOwnVotingPower(_user, _sourceSpaceId);
    }

    // Add delegated power if delegation contract is set (count number of delegators who are members)
    if (address(delegationContract) != address(0)) {
      address[] memory delegators = delegationContract.getDelegators(
        _user,
        _sourceSpaceId
      );
      for (uint256 i = 0; i < delegators.length; i++) {
        totalPower += _getOwnVotingPower(delegators[i], _sourceSpaceId);
      }
    }

    return totalPower;
  }

  /**
   * @dev Get only the user's own voting power (without delegation)
   * @param _user The address to check voting power for
   * @param _sourceSpaceId The space ID from which to derive voting power
   * @return The user's own voting power
   */
  function getOwnVotingPower(
    address _user,
    uint256 _sourceSpaceId
  ) external view returns (uint256) {
    return _getOwnVotingPower(_user, _sourceSpaceId);
  }

  /**
   * @dev Internal function to get user's own voting power
   */
  function _getOwnVotingPower(
    address _user,
    uint256 _sourceSpaceId
  ) internal view returns (uint256) {
    require(address(spaceFactory) != address(0), 'Space factory not set');
    require(_sourceSpaceId > 0, 'Invalid source space ID');
    return spaceFactory.isMember(_sourceSpaceId, _user) ? 1 : 0;
  }

  /**
   * @dev Get total voting power from a specific source space
   * @param _sourceSpaceId The space ID from which to derive total voting power
   * @return The total voting power (total number of members in source space)
   */
  function getTotalVotingPower(
    uint256 _sourceSpaceId
  ) external view override returns (uint256) {
    require(address(spaceFactory) != address(0), 'Space factory not set');
    require(_sourceSpaceId > 0, 'Invalid source space ID');
    address[] memory members = spaceFactory.getSpaceMembers(_sourceSpaceId);
    return members.length;
  }

  // New event for delegation contract
  event DelegationContractSet(address indexed delegationContract);
}
