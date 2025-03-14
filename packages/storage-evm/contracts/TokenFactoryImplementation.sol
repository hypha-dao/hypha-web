// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./storage/TokenFactoryStorage.sol";
import "./interfaces/ITokenFactory.sol";
import "./ERC20CustomMint.sol";

contract TokenFactoryImplementation is 
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
    TokenFactoryStorage,
    ITokenFactory 
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setSpacesContract(address _spacesContract) external onlyOwner {
        require(_spacesContract != address(0), "Spaces contract cannot be zero address");
        spacesContract = IDAOSpaceFactory(_spacesContract);
        emit SpacesContractUpdated(_spacesContract);
    }
    
    modifier onlySpaceFactoryOrAuthorized(uint256 spaceId) {
        require(
            msg.sender == address(spacesContract) || 
            (
                spacesContract.isSpaceCreator(spaceId, msg.sender) || 
                msg.sender == spacesContract.getSpaceExecutor(spaceId)
            ),
            "Unauthorized: not space factory or authorized caller"
        );
        _;
    }
    /*
    function deployToken(
        uint256 spaceId,
        string memory name,
        string memory symbol
    ) external override onlySpaceFactoryOrAuthorized(spaceId) returns (address) {
        require(address(spacesContract) != address(0), "Spaces contract not set");
        
        address executor = spacesContract.getSpaceExecutor(spaceId);
        
        SpaceToken newToken = new SpaceToken(
            name,
            symbol,
            executor,
            address(spacesContract),
            spaceId
        );
        
        // Only add token to space if called by authorized party (not space factory)
        if (msg.sender != address(spacesContract)) {
            spacesContract.addTokenToSpace(spaceId, address(newToken));
        }
        
        emit TokenDeployed(spaceId, address(newToken), name, symbol);
        
        return address(newToken);
    }
    */
function deployToken(
    uint256 spaceId,
    string memory name,
    string memory symbol
) external override returns (address) {
    require(address(spacesContract) != address(0), "Spaces contract not set");
    
    // If called by the space factory contract itself, skip additional checks
    if (msg.sender != address(spacesContract)) {
        require(
            spacesContract.isSpaceCreator(spaceId, msg.sender) || 
            msg.sender == spacesContract.getSpaceExecutor(spaceId),
            "Unauthorized: not space factory or authorized caller"
        );
    }
    
    address executor = spacesContract.getSpaceExecutor(spaceId);
    
    SpaceToken newToken = new SpaceToken(
        name,
        symbol,
        executor,
        address(spacesContract),
        spaceId
    );
    
    // Only add token to space if called by authorized party (not space factory)
    if (msg.sender != address(spacesContract)) {
        spacesContract.addTokenToSpace(spaceId, address(newToken));
    }
    
    emit TokenDeployed(spaceId, address(newToken), name, symbol);
    
    return address(newToken);
}

}