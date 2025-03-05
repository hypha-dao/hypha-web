// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./storage/JoinMethodDirectoryStorage.sol";
import "./interfaces/IJoinMethodDirectory.sol";

contract JoinMethodDirectoryImplementation is 
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
    JoinMethodDirectoryStorage,
    IJoinMethodDirectory 
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

    function setSpaceFactory(address _spaceFactory) external onlyOwner {
        require(_spaceFactory != address(0), "Invalid space factory address");
        spaceFactory = IDAOSpaceFactory(_spaceFactory);
    }

    function addJoinMethod(uint256 _methodId, address _implementation) external override onlyOwner {
        require(_implementation != address(0), "Invalid implementation address");
        require(address(joinMethods[_methodId]) == address(0), "Method ID already exists");
        
        joinMethods[_methodId] = IJoinMethod(_implementation);
        emit JoinMethodAdded(_methodId, _implementation);
    }

    function removeJoinMethod(uint256 _methodId) external override onlyOwner {
        require(address(joinMethods[_methodId]) != address(0), "Method does not exist");
        delete joinMethods[_methodId];
        emit JoinMethodRemoved(_methodId);
    }

    function joincheck(
        uint256 _spaceId, 
        uint256 _joinMethod, 
        address _userAddress
    ) external view override returns (bool) {
        IJoinMethod implementation = joinMethods[_joinMethod];
        
        if (address(implementation) == address(0)) {
            return false;
        }

        return implementation.checkJoin(_userAddress, _spaceId);
    }
}
