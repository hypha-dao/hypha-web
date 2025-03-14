// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IWorkProposal {
 
    // Functions
    function initialize(address initialOwner) external;
    
    function assignWork(
        uint256 _spaceId,
        address _worker,
        string memory _title,
        string memory _description,
        uint256 _duration,
        uint256 _amount,
        string memory _tokenSymbol,
        string[] memory _responsibilities
    ) external returns (uint256);

    function endWork(uint256 _workId) external;
    
    function setWorkInactive(uint256 _workId) external;
    
    function getWorkerActiveWorks(address _worker) external view returns (uint256[] memory);

   // Events
    event WorkAssigned(
        uint256 indexed workId,
        uint256 indexed spaceId,
        string title,
        string description,
        uint256 duration,
        uint256 amount,
        string tokenSymbol,
        address creator,
        address indexed worker,
        string[] responsibilities,
        uint256 createdAt
    );
    event WorkCompleted(uint256 indexed workId, address indexed worker);
    event WorkInactivated(uint256 indexed workId);


}