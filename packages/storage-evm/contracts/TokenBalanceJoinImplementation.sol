// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./storage/TokenBalanceJoinStorage.sol";
import "./interfaces/ITokenBalanceJoin.sol";

contract TokenBalanceJoinImplementation is 
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
    TokenBalanceJoinStorage,
    ITokenBalanceJoin 
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

    function setDAOSpaceFactory(address _daoSpaceFactory) external override onlyOwner {
        require(_daoSpaceFactory != address(0), "Invalid DAO Space Factory address");
        daoSpaceFactory = IDAOSpaceFactory(_daoSpaceFactory);
        emit DAOSpaceFactoryUpdated(_daoSpaceFactory);
    }

    /**
     * @dev Checks if the caller has permission to set token requirements
     * @param _spaceId The ID of the space
     * @return bool Returns true if caller is either space creator or executor
     */
    function _hasPermissionToSetRequirements(uint256 _spaceId) internal view returns (bool) {
        require(address(daoSpaceFactory) != address(0), "DAOSpaceFactory not set");
        
        // Check if caller is space creator
        bool isCreator = daoSpaceFactory.isSpaceCreator(_spaceId, msg.sender);
        
        // Get executor address and check if caller is executor
        address executor = daoSpaceFactory.getSpaceExecutor(_spaceId);
        bool isExecutor = (executor == msg.sender);
        
        return isCreator || isExecutor;
    }

    function setTokenRequirement(uint256 _spaceId, address _token, uint256 _requiredBalance) external override {
        require(_token != address(0), "Invalid token address");
        require(_hasPermissionToSetRequirements(_spaceId), "Only space creator or executor can set requirements");
        
        spaceTokenRequirements[_spaceId] = TokenRequirement(_token, _requiredBalance);
        emit TokenRequirementSet(_spaceId, _token, _requiredBalance);
    }

function checkJoin(address _userAddress, uint256 _spaceId) external view override returns (bool) {
    TokenRequirement memory requirement = spaceTokenRequirements[_spaceId];
    
    // If no token requirement has been set (token address is zero), return true
    if (requirement.token == address(0)) {
        return true;
    }
    
    // If token requirement exists, check the user's balance
    uint256 userBalance = IERC20(requirement.token).balanceOf(_userAddress);
    return userBalance >= requirement.requiredBalance;
}
}