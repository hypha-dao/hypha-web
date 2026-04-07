// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import './RainbowToken.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

/**
 * @title RainbowFactory
 * @dev Factory contract for deploying RainbowToken instances
 */
contract RainbowFactory is Ownable {
  // ============ State Variables ============

  // Array of all deployed tokens
  address[] public deployedTokens;

  // Mapping from symbol to token address
  mapping(string => address) public tokensBySymbol;

  // Events
  event TokenDeployed(
    address indexed tokenAddress,
    string name,
    string symbol,
    address indexed issuer,
    uint256 maxSupply
  );

  // ============ Constructor ============

  constructor() Ownable(msg.sender) {}

  // ============ Factory Functions ============

  /**
   * @dev Deploy a new RainbowToken
   */
  function createToken(
    string memory name,
    string memory symbol,
    address issuer,
    uint256 maxSupply,
    address withdrawalMgr,
    address withdrawTo,
    address freezeMgr,
    uint256 redeemLockedUntil,
    uint256 configLockedUntil
  ) external returns (address) {
    require(tokensBySymbol[symbol] == address(0), 'Symbol already exists');

    RainbowToken newToken = new RainbowToken(
      name,
      symbol,
      issuer,
      maxSupply,
      withdrawalMgr,
      withdrawTo,
      freezeMgr,
      redeemLockedUntil,
      configLockedUntil
    );

    address tokenAddress = address(newToken);

    deployedTokens.push(tokenAddress);
    tokensBySymbol[symbol] = tokenAddress;

    // Transfer ownership to issuer
    newToken.transferOwnership(issuer);

    emit TokenDeployed(tokenAddress, name, symbol, issuer, maxSupply);

    return tokenAddress;
  }

  /**
   * @dev Get all deployed tokens
   */
  function getAllTokens() external view returns (address[] memory) {
    return deployedTokens;
  }

  /**
   * @dev Get token by symbol
   */
  function getTokenBySymbol(
    string memory symbol
  ) external view returns (address) {
    return tokensBySymbol[symbol];
  }

  /**
   * @dev Get number of deployed tokens
   */
  function getTokenCount() external view returns (uint256) {
    return deployedTokens.length;
  }
}
