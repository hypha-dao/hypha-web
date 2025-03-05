// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITokenBalanceExit {
    function setDAOSpaceFactory(address _daoSpaceFactory) external;
    function setTokenRequirement(uint256 _spaceId, address _token, uint256 _requiredBalance) external;
    function checkExit(address _userAddress, uint256 _spaceId) external view returns (bool);

    event DAOSpaceFactoryUpdated(address indexed newAddress);
    event TokenRequirementSet(uint256 indexed spaceId, address indexed token, uint256 requiredBalance);
}