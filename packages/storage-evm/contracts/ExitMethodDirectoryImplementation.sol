
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./storage/ExitMethodDirectoryStorage.sol";
import "./interfaces/IExitMethodDirectory.sol";

contract ExitMethodDirectoryImplementation is 
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
    ExitMethodDirectoryStorage,
    IExitMethodDirectory 
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

    function addExitMethod(uint256 _methodId, address _implementation) external override onlyOwner {
        require(_implementation != address(0), "Invalid implementation address");
        require(address(exitMethods[_methodId]) == address(0), "Method ID already exists");
        
        exitMethods[_methodId] = IExitMethod(_implementation);
        emit ExitMethodAdded(_methodId, _implementation);
    }

    function removeExitMethod(uint256 _methodId) external override onlyOwner {
        require(address(exitMethods[_methodId]) != address(0), "Method does not exist");
        delete exitMethods[_methodId];
        emit ExitMethodRemoved(_methodId);
    }

    function exitcheck(
        uint256 _spaceId, 
        uint256 _exitMethod, 
        address _userAddress
    ) external view override returns (bool) {
        IExitMethod implementation = exitMethods[_exitMethod];
        
        if (address(implementation) == address(0)) {
            return false;
        }

        return implementation.checkExit(_userAddress, _spaceId);
    }
}