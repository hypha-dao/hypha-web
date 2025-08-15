// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '../interfaces/IVotingPowerDelegation.sol';

interface IDAOSpaceFactory {
  function isMember(
    uint256 _spaceId,
    address _userAddress
  ) external view returns (bool);

  function getSpaceMembers(
    uint256 _spaceId
  ) external view returns (address[] memory);
}

contract SpaceVotingPowerStorage is Initializable {
  IDAOSpaceFactory public spaceFactory;

  // Reference to the delegation contract
  IVotingPowerDelegation public delegationContract;

  /**
   * @dev This empty reserved space is put in place to allow future versions to add new
   * variables without shifting down storage in the inheritance chain.
   */
  uint256[48] private __gap;
}
