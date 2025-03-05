// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./storage/WorkProposalStorage.sol";
import "./interfaces/IWorkProposal.sol";

// New interface for Spaces contract
interface ISpaces {
    function getSpaceExecutor(uint256 spaceId) external view returns (address);
}

contract WorkProposalImplementation is 
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
    WorkProposalStorage,
    IWorkProposal 
{
    ISpaces public spacesContract;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        workCounter = 0;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // Modified modifier to check executor from Spaces contract
    modifier onlyExecutor(uint256 spaceId) {
        require(
            msg.sender == spacesContract.getSpaceExecutor(spaceId),
            "Only space executor can call this function"
        );
        _;
    }

    modifier onlyCreatorOrExecutor(uint256 _workId) {
        require(
            msg.sender == works[_workId].creator || 
            msg.sender == spacesContract.getSpaceExecutor(works[_workId].spaceId),
            "Only creator or executor can perform this action"
        );
        _;
    }

    modifier workExists(uint256 _workId) {
        require(_workId > 0 && _workId <= workCounter, "Work does not exist");
        _;
    }

    modifier workActive(uint256 _workId) {
        require(works[_workId].status == WorkStatus.Active, "Work is not active");
        _;
    }

    function setSpacesContract(address _newSpacesContract) external onlyOwner {
        require(_newSpacesContract != address(0), "Spaces contract cannot be zero address");
        spacesContract = ISpaces(_newSpacesContract);
    }

    function assignWork(
        uint256 _spaceId,
        address _worker,
        string memory _title,
        string memory _description,
        uint256 _duration,
        uint256 _amount,
        string memory _tokenSymbol,
        string[] memory _responsibilities
    ) external override onlyExecutor(_spaceId) returns (uint256) {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(_duration > 0, "Duration must be greater than 0");
        require(_amount > 0, "Amount must be greater than 0");
        require(bytes(_tokenSymbol).length > 0, "Token symbol cannot be empty");
        require(_responsibilities.length > 0, "Responsibilities cannot be empty");

        workCounter++;

        Work storage newWork = works[workCounter];
        newWork.title = _title;
        newWork.description = _description;
        newWork.duration = _duration;
        newWork.amount = _amount;
        newWork.tokenSymbol = _tokenSymbol;
        newWork.spaceId = _spaceId;
        newWork.creator = msg.sender;
        newWork.worker = _worker;
        newWork.createdAt = block.timestamp;
        newWork.responsibilities = _responsibilities;
        newWork.status = WorkStatus.Active;

        emit WorkAssigned(
            workCounter,
            _spaceId,
            _title,
            _description,
            _duration,
            _amount,
            _tokenSymbol,
            msg.sender,
            _worker,
            _responsibilities,
            block.timestamp
        );

        return workCounter;
    }

    function endWork(uint256 _workId) 
        external 
        override
        workExists(_workId) 
        workActive(_workId)
        onlyCreatorOrExecutor(_workId)
    {
        Work storage work = works[_workId];
        work.status = WorkStatus.Completed;
        
        emit WorkCompleted(_workId, work.worker);
    }

    function setWorkInactive(uint256 _workId) 
        external 
        override
        workExists(_workId)
    {
        Work storage work = works[_workId];
        require(
            msg.sender == spacesContract.getSpaceExecutor(work.spaceId),
            "Only space executor can call this function"
        );
        require(work.status != WorkStatus.Completed, "Cannot inactivate completed work");
        
        work.status = WorkStatus.Inactive;
        emit WorkInactivated(_workId);
    }

    function getWork(uint256 _workId) 
        external 
        view 
        workExists(_workId) 
        returns (
            string memory title,
            string memory description,
            uint256 duration,
            uint256 amount,
            string memory tokenSymbol,
            uint256 spaceId,
            address creator,
            address worker,
            uint256 createdAt,
            string[] memory responsibilities,
            WorkStatus status
        ) 
    {
        Work storage work = works[_workId];
        return (
            work.title,
            work.description,
            work.duration,
            work.amount,
            work.tokenSymbol,
            work.spaceId,
            work.creator,
            work.worker,
            work.createdAt,
            work.responsibilities,
            work.status
        );
    }

    function getWorkerActiveWorks(address _worker) 
        external 
        view 
        override
        returns (uint256[] memory activeWorkIds) 
    {
        uint256 activeCount = 0;
        
        // First count active works
        for (uint256 i = 1; i <= workCounter; i++) {
            if (works[i].worker == _worker && works[i].status == WorkStatus.Active) {
                activeCount++;
            }
        }
        
        // Create array of correct size and populate
        activeWorkIds = new uint256[](activeCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 1; i <= workCounter; i++) {
            if (works[i].worker == _worker && works[i].status == WorkStatus.Active) {
                activeWorkIds[currentIndex] = i;
                currentIndex++;
            }
        }
        
        return activeWorkIds;
    }
}