// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

contract AgreementsStorage is Initializable {
    // Mapping from spaceId to an array of proposalIds
    mapping(uint256 => uint256[]) internal spaceProposals;
    
    // Mapping to quickly check if a proposal exists for a space
    mapping(uint256 => mapping(uint256 => bool)) internal proposalExists;
    
    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     */
    uint256[50] private __gap;
} 
