// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDAOSpaceFactory {
    // First, we need to define the struct exactly as it is in the implementation
    struct SpaceCreationParams {
        string name;
        string description;
        string imageUrl;
        uint256 unity;
        uint256 quorum;
        uint256 votingPowerSource;
        uint256 exitMethod;
        uint256 joinMethod;
        bool createToken;
        string tokenName;
        string tokenSymbol;
    }

    function initialize(address initialOwner) external;
    
    function setContracts(
        address _tokenFactoryAddress, 
        address _joinMethodDirectoryAddress,
        address _proposalManagerAddress,
        address _exitMethodDirectoryAddress

    ) external;
    
    // Make sure the function signature matches exactly
    function createSpace(SpaceCreationParams calldata params) external returns (uint256);
    
    function joinSpace(uint256 _spaceId) external;
    
    function removeMember(uint256 _spaceId, address _memberToRemove) external;
    
    function addTokenToSpace(uint256 _spaceId, address _tokenAddress) external;
    
    function getSpaceMembers(uint256 _spaceId) external view returns (address[] memory);
    
    function hasToken(uint256 _spaceId, address _tokenAddress) external view returns (bool);
    
    function getSpaceExecutor(uint256 _spaceId) external view returns (address);
    
    function isMember(uint256 _spaceId, address _userAddress) external view returns (bool);
    
    function isSpaceCreator(uint256 _spaceId, address _userAddress) external view returns (bool);
    
    function getSpaceDetails(uint256 _spaceId) external view returns (
        string memory name,
        uint256 unity,
        uint256 quorum,
        uint256 votingPowerSource,
        address[] memory tokenAddresses,
        address[] memory members,
        uint256 exitMethod,
        uint256 joinMethod,
        uint256 createdAt,
        address creator,
        address executor
    );

    function getSpaceMemberAddresses(uint256 _spaceId) external view returns (address[] memory);

    event SpaceCreated(
        uint256 indexed spaceId,
        string name,
        string description,
        string imageUrl,
        uint256 unity,
        uint256 quorum,
        uint256 votingPowerSource,
        uint256 exitMethod,
        uint256 joinMethod,
        address indexed creator,
        address indexed executor
    );
    
    event MemberJoined(uint256 indexed spaceId, address indexed member);
    event DirectoryContractUpdated(address indexed newAddress);
    event MemberRemoved(uint256 indexed spaceId, address indexed member);
    event TokenFactoryContractUpdated(address indexed newAddress);
    event JoinMethodDirectoryContractUpdated(address indexed newAddress);
    event ProposalManagerUpdated(address indexed newAddress);
    event ExitMethodDirectoryContractUpdated(address indexed newAddress);
}