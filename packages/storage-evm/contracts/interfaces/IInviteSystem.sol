// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IInviteSystem {
    function initialize(address initialOwner) external;
    function setSpaceFactory(address _spaceFactoryAddress) external;
    function createInvite(address _invitee, uint256 _spaceId) external returns (bool);
    function deleteInvite(uint256 _spaceId) external;
    function checkJoin(address _userAddress, uint256 _spaceId) external view returns (bool);

    // Events
    event InviteCreated(uint256 indexed spaceId, address indexed inviter, address indexed invitee, uint256 timestamp);
    event InviteDeleted(uint256 indexed spaceId, address indexed invitee);
    event SpaceFactorySet(address spaceFactory);
    event BatchInvitesCreated(uint256 indexed spaceId,address indexed inviter,address[] invitees,uint256 timestamp);
    
}