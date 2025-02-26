// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// Interface for exit method implementations
interface IExitMethod {
    function checkExit(address _userAddress, uint256 _spaceId) external view returns (bool);
}

interface IDAOSpaceFactory {
    function isMember(uint256 _spaceId, address _userAddress) external view returns (bool);
}

contract ExitMethodDirectoryStorage is Initializable {
    // State variables
    IDAOSpaceFactory public spaceFactory;
    
    // Mapping to store exit method implementations
    mapping(uint256 => IExitMethod) public exitMethods;

}