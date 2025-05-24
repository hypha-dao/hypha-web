// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IEnergyDistribution {
    struct EnergySource {
        uint256 sourceId;
        uint256 price;
        uint256 quantity;
    }
    
    struct Member {
        address memberAddress;
        uint256[] deviceIds;
        uint256 ownershipPercentage; // in basis points (10000 = 100%)
        bool isActive;
    }
    
    struct CollectiveConsumption {
        address owner;
        uint256 price;
        uint256 quantity;
    }
    
    struct ConsumptionRequest {
        uint256 deviceId;
        uint256 quantity;
    }
    
    struct MemberConsumptionData {
        address memberAddress;
        uint256 consumed;
        uint256 allocated;
        int256 excess; // negative if under-consumed, positive if over-consumed
    }
    
    function initialize(address initialOwner) external;
    
    function addMember(
        address memberAddress,
        uint256[] calldata deviceIds,
        uint256 ownershipPercentage
    ) external;
    
    function removeMember(address memberAddress) external;
    
    function distributeEnergyTokens(
        EnergySource[] calldata sources
    ) external;
    
    function consumeEnergyTokens(
        ConsumptionRequest[] calldata consumptionRequests
    ) external;
    
    function getCashCreditBalance(address member) external view returns (int256);
    
    function getCollectiveConsumption() external view returns (CollectiveConsumption[] memory);
    
    function getMember(address memberAddress) external view returns (Member memory);
    
    function getAllocatedTokens(address member) external view returns (uint256);
    
    function getTotalOwnershipPercentage() external view returns (uint256);
    
    function getDeviceOwner(uint256 deviceId) external view returns (address);
    
    // Events
    event MemberAdded(address indexed memberAddress, uint256[] deviceIds, uint256 ownershipPercentage);
    event MemberRemoved(address indexed memberAddress);
    event EnergyDistributed(uint256 totalSources, uint256 totalQuantity);
    event EnergyConsumed(address indexed member, uint256 quantity, int256 cashCreditBalance);
    event CollectiveConsumptionUpdated(uint256 totalItems);
} 