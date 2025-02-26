// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./storage/ProfileManagerStorage.sol";
import "./interfaces/IProfileManager.sol";
// ProfileManagerImplementation.sol
contract ProfileManagerImplementation is 
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable, 
    ProfileManagerStorage, 
    IProfileManager 
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

    modifier profileExists() {
        require(profiles[msg.sender].exists, "Profile does not exist");
        _;
    }

    modifier profileDoesNotExist() {
        require(!profiles[msg.sender].exists, "Profile already exists");
        _;
    }

    function createProfile(
        string memory _username,
        string memory _description,
        string memory _profileImg
    ) external override profileDoesNotExist {
        require(bytes(_username).length > 0, "Username cannot be empty");

        // Set profile existence
        profiles[msg.sender].exists = true;
        
        // Set profile data
        profilesData[msg.sender] = ProfileData({
            username: _username,
            description: _description,
            profileImg: _profileImg,
            userAddress: msg.sender
        });

        emit ProfileCreated(msg.sender, _username, _description, _profileImg);
    }

    function editProfile(
        string memory _username,
        string memory _description,
        string memory _profileImg
    ) external override {
        require(profiles[msg.sender].exists, "Profile does not exist");
        require(profilesData[msg.sender].userAddress == msg.sender, "Only profile owner can edit their profile");
        require(bytes(_username).length > 0, "Username cannot be empty");

        ProfileData storage profileData = profilesData[msg.sender];
        profileData.username = _username;
        profileData.description = _description;
        profileData.profileImg = _profileImg;

        emit ProfileUpdated(msg.sender, _username, _description, _profileImg);
    }

    function deleteProfile() external override {
        require(profiles[msg.sender].exists, "Profile does not exist");
        require(profilesData[msg.sender].userAddress == msg.sender, "Only profile owner can delete their profile");
        
        delete profiles[msg.sender];
        delete profilesData[msg.sender];
        
        emit ProfileDeleted(msg.sender);
    }

    function hasProfile(address _address) external view override returns (bool) {
        return profiles[_address].exists;
    }

    function getProfile(address _address) 
        external 
        view 
        override 
        returns (
            string memory username,
            string memory description,
            string memory profileImg,
            bool exists
        ) 
    {
        ProfileData storage profileData = profilesData[_address];
        return (
            profileData.username,
            profileData.description,
            profileData.profileImg,
            profiles[_address].exists
        );
    }
}