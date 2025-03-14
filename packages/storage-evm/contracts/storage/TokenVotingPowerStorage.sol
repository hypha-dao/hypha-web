// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

contract TokenVotingPowerStorage is Initializable {
    // Mapping from space ID to its associated token address
    mapping(uint256 => address) public spaceTokens;

}