// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./storage/VotingPowerDirectoryStorage.sol";
import "./interfaces/IVotingPowerDirectory.sol";

contract VotingPowerDirectoryImplementation is 
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
    VotingPowerDirectoryStorage,
    IVotingPowerDirectory 
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        sourceCounter = 0;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function addVotingPowerSource(address _contractAddress) external override onlyOwner returns (uint256) {
        require(_contractAddress != address(0), "Invalid contract address");
        
        sourceCounter++;
        votingPowerSources[sourceCounter] = _contractAddress;

        emit VotingPowerSourceAdded(sourceCounter, _contractAddress);
        return sourceCounter;
    }

    function removeVotingPowerSource(uint256 _sourceId) external override onlyOwner {
        require(_sourceId > 0 && _sourceId <= sourceCounter, "Invalid source ID");
        require(votingPowerSources[_sourceId] != address(0), "Source already removed");
        
        delete votingPowerSources[_sourceId];
        emit VotingPowerSourceRemoved(_sourceId);
    }

    function getVotingPowerSourceContract(uint256 _sourceId) external view override returns (address) {
        require(_sourceId > 0 && _sourceId <= sourceCounter, "Invalid source ID");
        address sourceAddress = votingPowerSources[_sourceId];
        require(sourceAddress != address(0), "Source not found or removed");
        return sourceAddress;
    }
}