// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IProfileManager {
    event ProfileCreated(
        address indexed userAddress,
        string username,
        string description,
        string profileImg
    );
    
    event ProfileUpdated(
        address indexed userAddress,
        string username,
        string description,
        string profileImg
    );
    
    event ProfileDeleted(address indexed userAddress);

    function createProfile(
        string memory username,
        string memory description,
        string memory profileImg
    ) external;

    function editProfile(
        string memory username,
        string memory description,
        string memory profileImg
    ) external;

    function deleteProfile() external;

    function hasProfile(address _address) external view returns (bool);
    
    function getProfile(address _address) external view returns (
        string memory username,
        string memory description,
        string memory profileImg,
        bool exists
    );
}