// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '../interfaces/ITokenBackingVault.sol';

contract TokenBackingVaultStorage is Initializable {
  uint256 public vaultCounter;

  mapping(uint256 => ITokenBackingVault.VaultConfig) internal vaults;
  mapping(uint256 => mapping(address => ITokenBackingVault.BackingTokenConfig))
    internal backingConfigs;
  mapping(uint256 => address[]) internal backingTokenList;
  mapping(uint256 => mapping(address => uint256))
    internal vaultBackingBalance;

  address public spacesContract;

  mapping(uint256 => uint256[]) internal spaceVaultIds;
  mapping(bytes32 => uint256) internal vaultKeys;

  // Whitelist: vault ID => address => whitelisted
  mapping(uint256 => mapping(address => bool)) internal whitelist;

  // Redemption price override (0 = use official token price)
  mapping(uint256 => uint256) internal vaultRedemptionPrice;
  mapping(uint256 => address) internal vaultRedemptionPriceCurrencyFeed;

  uint256[40] private __gap;
}

