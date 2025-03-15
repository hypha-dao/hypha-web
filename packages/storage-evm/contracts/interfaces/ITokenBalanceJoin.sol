// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITokenBalanceJoin {
    function initialize(address initialOwner) external;
    function setDAOSpaceFactory(address _daoSpaceFactory) external;
    function setTokenRequirement(uint256 _spaceId, address _token, uint256 _requiredBalance) external;
    function checkJoin(address _userAddress, uint256 _spaceId) external view returns (bool);

    event TokenRequirementSet(uint256 indexed spaceId, address indexed token, uint256 requiredBalance);
    event DAOSpaceFactoryUpdated(address indexed newAddress);
}