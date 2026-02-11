// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '../interfaces/IPeggedVault.sol';

contract PeggedVaultStorage is Initializable {
  // Counter for vault IDs (internal, users never need this)
  uint256 public vaultCounter;

  // Internal vault ID => core configuration
  mapping(uint256 => IPeggedVault.VaultConfig) internal vaults;

  // Internal vault ID => backing token address => per-token config
  mapping(uint256 => mapping(address => IPeggedVault.BackingTokenConfig))
    internal backingConfigs;

  // Internal vault ID => ordered list of backing token addresses
  mapping(uint256 => address[]) internal backingTokenList;

  // Internal vault ID => backing token address => tracked balance
  mapping(uint256 => mapping(address => uint256))
    internal vaultBackingBalance;

  // Spaces contract for membership checks
  address public spacesContract;

  // Space ID => list of internal vault IDs belonging to that space
  mapping(uint256 => uint256[]) internal spaceVaultIds;

  // Primary key: keccak256(spaceId, spaceToken) => internal vault ID
  mapping(bytes32 => uint256) internal vaultKeys;

  // Whitelist: vault ID => address => whitelisted
  mapping(uint256 => mapping(address => bool)) internal whitelist;

  /**
   * @dev This empty reserved space is put in place to allow future versions to add new
   * variables without shifting down storage in the inheritance chain.
   */
  uint256[42] private __gap;
}

