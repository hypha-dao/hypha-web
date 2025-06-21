// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAgreements {
    function initialize(address initialOwner) external;
    
    function setContracts(address _spaceFactory) external;
    
    function acceptAgreement(uint256 _spaceId, uint256 _proposalId) external;
    
    function getSpaceProposals(uint256 _spaceId) external view returns (uint256[] memory);
    
    function hasProposal(uint256 _spaceId, uint256 _proposalId) external view returns (bool);
    
    // Events
    event AgreementAccepted(uint256 indexed spaceId, uint256 indexed proposalId, address executor);
} 
