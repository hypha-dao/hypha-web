// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IJoinMethodDirectory {
    function addJoinMethod(uint256 _methodId, address _implementation) external;
    function removeJoinMethod(uint256 _methodId) external;
    function joincheck(uint256 _spaceId, uint256 _joinMethod, address _userAddress) external view returns (bool);

    // Events
    event JoinMethodAdded(uint256 indexed methodId, address indexed implementation);
    event JoinMethodRemoved(uint256 indexed methodId);
}
