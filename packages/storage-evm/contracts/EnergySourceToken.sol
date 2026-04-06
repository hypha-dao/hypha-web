// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

/// @title  EnergySourceToken
/// @notice ERC-20 representing fractional ownership of an energy source
///         (solar park, battery, etc.). A member's ownership percentage is
///         simply `balanceOf(member) * 10000 / totalSupply()` (basis points).
///
///         The VPP backend reads these on-chain to compute revenue splits.
///         Tokens are freely transferable — ownership can change hands.
///
/// @dev    Deploy one token per energy source. Example:
///           - "Solar Park Alpha" (SOLAR-A), supply 10000
///           - "Battery Unit 1"   (BAT-1),   supply 10000
///         Then distribute tokens to investors:
///           Alice gets 3000 SOLAR-A → 30% solar ownership
///           Alice gets 2500 BAT-1   → 25% battery ownership
contract EnergySourceToken is ERC20, Ownable {
  uint8 private immutable _tokenDecimals;

  /// @param name_         Token name, e.g. "Solar Park Alpha"
  /// @param symbol_       Token symbol, e.g. "SOLAR-A"
  /// @param totalSupply_  Total ownership units (e.g. 10000 for basis-point granularity)
  /// @param decimals_     Typically 0 for ownership tokens
  /// @param initialHolder Receives the entire supply at deployment; distributes to investors
  constructor(
    string memory name_,
    string memory symbol_,
    uint256 totalSupply_,
    uint8 decimals_,
    address initialHolder
  ) ERC20(name_, symbol_) Ownable(initialHolder) {
    _tokenDecimals = decimals_;
    _mint(initialHolder, totalSupply_);
  }

  function decimals() public view override returns (uint8) {
    return _tokenDecimals;
  }

  /// @notice Mint additional tokens (e.g. community expands the solar park
  ///         and sells new ownership shares to investors).
  function mint(address to, uint256 amount) external onlyOwner {
    _mint(to, amount);
  }

  /// @notice Burn tokens (e.g. decommissioning part of a source).
  function burn(uint256 amount) external {
    _burn(msg.sender, amount);
  }

  /// @notice Convenience: returns ownership in basis points (0–10000).
  function ownershipBpsOf(address account) external view returns (uint256) {
    uint256 supply = totalSupply();
    if (supply == 0) return 0;
    return (balanceOf(account) * 10000) / supply;
  }
}
