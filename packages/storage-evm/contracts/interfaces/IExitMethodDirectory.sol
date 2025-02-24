// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IExitMethodDirectory {
    function addExitMethod(uint256 _methodId, address _implementation) external;
    function removeExitMethod(uint256 _methodId) external;
    function exitcheck(uint256 _spaceId, uint256 _exitMethod, address _userAddress) external view returns (bool);

    // Events
    event ExitMethodAdded(uint256 indexed methodId, address indexed implementation);
    event ExitMethodRemoved(uint256 indexed methodId);

}