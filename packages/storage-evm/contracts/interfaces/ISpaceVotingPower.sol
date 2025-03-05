// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISpaceVotingPower {
    function initialize(address initialOwner) external;
    function setSpaceFactory(address _spaceFactory) external;
    function getVotingPower(address _user, uint256 _sourceSpaceId) external view returns (uint256);
    function getTotalVotingPower(uint256 _sourceSpaceId) external view returns (uint256);

    // Events
    event SpaceFactoryUpdated(address indexed newSpaceFactory);
}