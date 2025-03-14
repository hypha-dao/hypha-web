// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface IDAOSpaceFactory {
    function addTokenToSpace(uint256 spaceId, address tokenAddress) external;
    function isSpaceCreator(uint256 spaceId, address userAddress) external view returns (bool);
    function getSpaceExecutor(uint256 spaceId) external view returns (address);
}

contract TokenFactoryStorage is Initializable {
    IDAOSpaceFactory public spacesContract;
    
    event TokenDeployed(uint256 indexed spaceId, address indexed tokenAddress, string name, string symbol);
    event SpacesContractUpdated(address indexed newSpacesContract);
}