// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./storage/InviteSystemStorage.sol";
import "./interfaces/IInviteSystem.sol";

contract InviteSystemImplementation is 
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
    InviteSystemStorage,
    IInviteSystem 
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

    function setSpaceFactory(address _spaceFactoryAddress) external override onlyOwner {
        require(_spaceFactoryAddress != address(0), "Invalid space factory address");
        require(address(spaceFactory) == address(0), "Space factory already set");
        spaceFactory = IDAOSpaceFactory(_spaceFactoryAddress);
        emit SpaceFactorySet(_spaceFactoryAddress);
    }

    function createInvite(address _invitee, uint256 _spaceId) external override returns (bool) {
        return _createSingleInvite(_invitee, _spaceId);
    }

    function createBatchInvites(address[] calldata _invitees, uint256 _spaceId) external returns (bool) {
        require(_invitees.length > 0, "Empty invitees array");
        require(_invitees.length <= 100, "Too many invitees"); // Gas limit protection
        
        require(spaceFactory.isMember(_spaceId, msg.sender), "Not a member of the space");

        for (uint i = 0; i < _invitees.length; i++) {
            address invitee = _invitees[i];
            if (invitee != address(0) && !invites[_spaceId][invitee].isValid) {
                _createSingleInvite(invitee, _spaceId);
            }
        }

        emit BatchInvitesCreated(_spaceId, msg.sender, _invitees, block.timestamp);
        return true;
    }

    function _createSingleInvite(address _invitee, uint256 _spaceId) internal returns (bool) {
        require(_invitee != address(0), "Invalid invitee address");
        require(spaceFactory.isMember(_spaceId, msg.sender), "Not a member of the space");
        require(!invites[_spaceId][_invitee].isValid, "Invite already exists");

        invites[_spaceId][_invitee] = Invite({
            inviter: msg.sender,
            invitee: _invitee,
            spaceId: _spaceId,
            createdAt: block.timestamp,
            isValid: true
        });

        emit InviteCreated(_spaceId, msg.sender, _invitee, block.timestamp);
        return true;
    }

    function deleteInvite(uint256 _spaceId) external override {
        require(invites[_spaceId][msg.sender].isValid, "No valid invite exists");
        
        invites[_spaceId][msg.sender].isValid = false;
        emit InviteDeleted(_spaceId, msg.sender);
    }

    function checkJoin(address _userAddress, uint256 _spaceId) external view override returns (bool) {
        return invites[_spaceId][_userAddress].isValid;
    }
}