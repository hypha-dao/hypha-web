// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

interface IDAOSpaceFactory {
    function isSpaceCreator(uint256 _spaceId, address _userAddress) external view returns (bool);
    function getSpaceExecutor(uint256 _spaceId) external view returns (address);
}

contract TokenBalanceJoinStorage is Initializable {
    struct TokenRequirement {
        address token;
        uint256 requiredBalance;
    }
    
    mapping(uint256 => TokenRequirement) public spaceTokenRequirements;
    IDAOSpaceFactory public daoSpaceFactory;

}
