// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

/**
 * @title TransferHelper
 * @dev A helper contract to route all token transfers through a single whitelisted contract
 * This allows a single contract to be whitelisted with Coinbase (or other paymasters)
 * instead of having to whitelist each individual token contract
 *
 * Users must approve this contract to spend their tokens before calling transfer functions
 */
contract TransferHelper is Ownable, ReentrancyGuard {
  using SafeERC20 for IERC20;

  // Track supported tokens (optional - can be used to restrict which tokens can be transferred)
  mapping(address => bool) public supportedTokens;
  bool public requireTokenWhitelist;

  event TransferExecuted(
    address indexed token,
    address indexed from,
    address indexed to,
    uint256 amount
  );

  event TokenWhitelisted(address indexed token, bool status);
  event WhitelistRequirementChanged(bool required);

  constructor() Ownable(msg.sender) {
    requireTokenWhitelist = false; // By default, allow all tokens
  }

  /**
   * @dev Transfer tokens from msg.sender to a recipient
   * @param token The ERC20 token contract address
   * @param to The recipient address
   * @param amount The amount to transfer
   *
   * Requirements:
   * - msg.sender must have approved this contract for at least `amount` tokens
   * - msg.sender must have sufficient balance
   * - Token must be whitelisted (if whitelist is enabled)
   */
  function transferToken(
    address token,
    address to,
    uint256 amount
  ) external nonReentrant {
    require(to != address(0), 'TransferHelper: transfer to zero address');
    require(amount > 0, 'TransferHelper: amount must be greater than 0');
    _checkTokenSupport(token);

    // Transfer tokens from sender to recipient via this contract
    IERC20(token).safeTransferFrom(msg.sender, to, amount);

    emit TransferExecuted(token, msg.sender, to, amount);
  }

  /**
   * @dev Set whether a specific token is supported
   * @param token The token address
   * @param status Whether the token is supported
   */
  function setTokenWhitelist(address token, bool status) external onlyOwner {
    require(token != address(0), 'TransferHelper: invalid token address');
    supportedTokens[token] = status;
    emit TokenWhitelisted(token, status);
  }

  /**
   * @dev Set whether token whitelist is required
   * @param required Whether whitelist is required
   */
  function setWhitelistRequirement(bool required) external onlyOwner {
    requireTokenWhitelist = required;
    emit WhitelistRequirementChanged(required);
  }

  /**
   * @dev Check if a token is supported for transfers
   * @param token The token address to check
   */
  function _checkTokenSupport(address token) internal view {
    require(token != address(0), 'TransferHelper: invalid token address');
    require(token.code.length > 0, 'TransferHelper: not a contract');

    if (requireTokenWhitelist) {
      require(supportedTokens[token], 'TransferHelper: token not whitelisted');
    }
  }

  /**
   * @dev Check if a token is whitelisted
   * @param token The token address to check
   */
  function isTokenSupported(address token) external view returns (bool) {
    if (!requireTokenWhitelist) {
      return true;
    }
    return supportedTokens[token];
  }
}
