// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface IDAOSpaceFactory {
    function isMember(uint256 _spaceId, address _userAddress) external view returns (bool);
}

contract InviteSystemStorage is Initializable {
    struct Invite {
        address inviter;
        address invitee;
        uint256 spaceId;
        uint256 createdAt;
        bool isValid;
    }

    // Mapping from spaceId => invitee => Invite
    mapping(uint256 => mapping(address => Invite)) public invites;
    IDAOSpaceFactory public spaceFactory;


}
