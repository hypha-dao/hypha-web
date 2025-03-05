// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./storage/TokenBalanceExitStorage.sol";
import "./interfaces/ITokenBalanceExit.sol";

contract TokenBalanceExitImplementation is 
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
    TokenBalanceExitStorage,
    ITokenBalanceExit 
{
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

    function _hasPermissionToSetRequirements(uint256 _spaceId) internal view returns (bool) {
        require(address(daoSpaceFactory) != address(0), "DAOSpaceFactory not set");
        
        bool isCreator = daoSpaceFactory.isSpaceCreator(_spaceId, msg.sender);
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

    function checkExit(address _userAddress, uint256 _spaceId) external view override returns (bool) {
        TokenRequirement memory requirement = spaceTokenRequirements[_spaceId];
        
        // If no token requirement has been set (token address is zero), return false
        if (requirement.token == address(0)) {
            return false;
        }
        
        // If token requirement exists, check if user's balance is BELOW the requirement
        uint256 userBalance = IERC20(requirement.token).balanceOf(_userAddress);
        return userBalance < requirement.requiredBalance;
    }
}