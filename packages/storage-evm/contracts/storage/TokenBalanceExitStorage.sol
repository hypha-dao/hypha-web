// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface IDAOSpaceFactory {
    function isSpaceCreator(uint256 _spaceId, address _userAddress) external view returns (bool);
    function getSpaceExecutor(uint256 _spaceId) external view returns (address);
}

contract TokenBalanceExitStorage is Initializable {
    IDAOSpaceFactory public daoSpaceFactory;
    
    struct TokenRequirement {
        address token;
        uint256 requiredBalance;
    }
    
    mapping(uint256 => TokenRequirement) public spaceTokenRequirements;

}