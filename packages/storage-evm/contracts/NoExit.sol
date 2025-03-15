// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract NoExit {
    function checkExit(
        address _userAddress,
        uint256 _spaceId
    ) external pure returns (bool) {
        return false;
    }
}
