// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// ProfileManagerStorage.sol
contract ProfileManagerStorage is Initializable {
    // Original structure to store profile existence
    struct Profile {
        bool exists;
    }

    // New structure to store profile data
    struct ProfileData {
        string username;
        string description;
        string profileImg;
        address userAddress;
    }

    // Original mapping from address to profile existence
    mapping(address => Profile) public profiles;
    
    // New mapping from address to profile data
    mapping(address => ProfileData) public profilesData;
}