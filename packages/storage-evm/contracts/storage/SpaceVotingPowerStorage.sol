// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface IDAOSpaceFactory {
    function isMember(uint256 _spaceId, address _userAddress) external view returns (bool);
    function getSpaceMembers(uint256 _spaceId) external view returns (address[] memory);
}

contract SpaceVotingPowerStorage is Initializable {
    IDAOSpaceFactory public spaceFactory;
    
}
