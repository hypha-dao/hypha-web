// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '../interfaces/IEnergyDistribution.sol';

contract EnergyDistributionStorage is Initializable {
    // Members storage
    mapping(address => IEnergyDistribution.Member) internal members;
    address[] internal memberAddresses;
    
    // Device to member mapping
    mapping(uint256 => address) internal deviceToMember;
    
    // Allocated tokens per member from last distribution
    mapping(address => uint256) internal allocatedTokens;
    
    // Collective consumption list (sorted by price)
    IEnergyDistribution.CollectiveConsumption[] internal collectiveConsumption;
    
    // Cash credit balances
    mapping(address => int256) internal cashCreditBalances;
    
    // Total ownership percentage (should always be 10000)
    uint256 internal totalOwnershipPercentage;
    
    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     */
    uint256[44] private __gap;
} 