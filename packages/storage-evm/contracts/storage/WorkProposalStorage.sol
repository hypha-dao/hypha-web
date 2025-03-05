// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract WorkProposalStorage is Initializable {
    // Enums
    enum WorkStatus { Inactive, Active, Completed }

    // Structs
    struct Work {
        string title;
        string description;
        uint256 duration;
        uint256 amount;
        string tokenSymbol;
        uint256 spaceId;
        address creator;
        address worker;
        uint256 createdAt;
        string[] responsibilities;
        WorkStatus status;
    }

    // Storage variables - DO NOT MODIFY ORDER
    mapping(uint256 => Work) public works;
    uint256 public workCounter;
    address public executor;
    // Removed owner variable since it's provided by OwnableUpgradeable

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     */
    uint256[48] private __gap;
}