// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// Interface for join method implementations
interface IJoinMethod {
    function checkJoin(address _userAddress, uint256 _spaceId) external view returns (bool);
}

interface IDAOSpaceFactory {
    function isMember(uint256 _spaceId, address _userAddress) external view returns (bool);
}

contract JoinMethodDirectoryStorage is Initializable {
    // State variables
    IDAOSpaceFactory public spaceFactory;
    
    // Mapping to store join method implementations
    mapping(uint256 => IJoinMethod) public joinMethods;

}
