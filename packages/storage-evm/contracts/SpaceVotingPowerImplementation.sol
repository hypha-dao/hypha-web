// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./storage/SpaceVotingPowerStorage.sol";
import "./interfaces/ISpaceVotingPower.sol";

/**
 * @title SpaceVotingPower
 * @dev Manages voting power calculations based on dynamic space membership
 */
contract SpaceVotingPowerImplementation is 
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
    SpaceVotingPowerStorage,
    ISpaceVotingPower 
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

    /**
     * @dev Set the space factory contract address
     * @param _spaceFactory The address of the space factory contract
     */
    function setSpaceFactory(address _spaceFactory) external override onlyOwner {
        require(_spaceFactory != address(0), "Invalid factory address");
        spaceFactory = IDAOSpaceFactory(_spaceFactory);
        emit SpaceFactoryUpdated(_spaceFactory);
    }

    /**
     * @dev Get voting power for a user from a specific source space
     * @param _user The address to check voting power for
     * @param _sourceSpaceId The space ID from which to derive voting power
     * @return The voting power (1 if member, 0 if not)
     */
    function getVotingPower(
        address _user, 
        uint256 _sourceSpaceId
    ) external view override returns (uint256) {
        require(address(spaceFactory) != address(0), "Space factory not set");
        require(_sourceSpaceId > 0, "Invalid source space ID");
        return spaceFactory.isMember(_sourceSpaceId, _user) ? 1 : 0;
    }

    /**
     * @dev Get total voting power from a specific source space
     * @param _sourceSpaceId The space ID from which to derive total voting power
     * @return The total voting power (total number of members in source space)
     */
    function getTotalVotingPower(
        uint256 _sourceSpaceId
    ) external view override returns (uint256) {
        require(address(spaceFactory) != address(0), "Space factory not set");
        require(_sourceSpaceId > 0, "Invalid source space ID");
        address[] memory members = spaceFactory.getSpaceMembers(_sourceSpaceId);
        return members.length;
    }
}