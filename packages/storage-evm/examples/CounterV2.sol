// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// An upgradeable counter contract with UUPS pattern
contract CounterV2 is UUPSUpgradeable, OwnableUpgradeable {
    // Counter value
    uint256 private count;

    // Event emitted when count changes
    event CountChanged(uint256 count);

    // Initializes the contract, setting up ownership and upgrade capabilities
    // This function replaces the constructor and can only be called once due to the initializer modifier
    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    // Increments the counter by 1
    function increment() public {
        count += 1;
        emit CountChanged(count);
    }

    // Returns the current count
    function getCount() public view returns (uint256) {
        return count;
    }

    // Resets the counter to 0
    function reset() public {
        count = 0;
        emit CountChanged(count);
    }

    // Authorizes an upgrade (only owner can call)
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
