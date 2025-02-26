// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IVotingPowerDirectory {
    function addVotingPowerSource(address _contractAddress) external returns (uint256);
    function removeVotingPowerSource(uint256 _sourceId) external;
    function getVotingPowerSourceContract(uint256 _sourceId) external view returns (address);

    // Events
    event VotingPowerSourceAdded(uint256 indexed sourceId, address contractAddress);
    event VotingPowerSourceRemoved(uint256 indexed sourceId);
}