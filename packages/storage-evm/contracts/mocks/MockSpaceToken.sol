// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol';

/**
 * @dev Mock space token for testing Token Backing Vault.
 * Supports mint, burn, burnFrom, and a configurable priceInUSD (6 decimals).
 */
contract MockSpaceToken is ERC20, ERC20Burnable {
  uint256 public priceInUSD; // Legacy — kept for backward compatibility
  address public priceCurrencyFeed; // Chainlink X/USD feed, address(0) = USD
  uint256 public tokenPrice; // Canonical price (6 decimals)

  constructor(
    string memory name,
    string memory symbol,
    uint256 _price
  ) ERC20(name, symbol) {
    priceInUSD = _price;
    tokenPrice = _price;
  }

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function setPriceInUSD(uint256 _price) external {
    priceInUSD = _price;
    tokenPrice = _price;
  }

  function setPriceWithCurrency(uint256 _price, address _currencyFeed) external {
    priceInUSD = _price;
    tokenPrice = _price;
    priceCurrencyFeed = _currencyFeed;
  }
}


