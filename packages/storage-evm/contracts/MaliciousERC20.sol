// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title MaliciousERC20
 * @dev A mock ERC20 contract that always returns false on transfer
 * This is used for testing TransferHelper's error handling
 */
contract MaliciousERC20 {
  string public constant name = 'Malicious Token';
  string public constant symbol = 'MAL';
  uint8 public constant decimals = 18;
  uint256 public constant totalSupply = 1000000 * 10 ** 18;

  /**
   * @dev Always returns false to simulate a failed transfer
   */
  function transfer(address, uint256) external pure returns (bool) {
    return false;
  }

  /**
   * @dev Always returns false to simulate a failed transferFrom
   */
  function transferFrom(
    address,
    address,
    uint256
  ) external pure returns (bool) {
    return false;
  }

  /**
   * @dev Returns a fake balance
   */
  function balanceOf(address) external pure returns (uint256) {
    return 1000 * 10 ** 18;
  }

  /**
   * @dev Returns a fake allowance
   */
  function allowance(address, address) external pure returns (uint256) {
    return 1000 * 10 ** 18;
  }

  /**
   * @dev Always returns true for approve (to make setup easier in tests)
   */
  function approve(address, uint256) external pure returns (bool) {
    return true;
  }
}
