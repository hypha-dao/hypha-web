// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '../interfaces/IEnergyDistribution.sol';
import '../EnergyToken.sol';

contract EnergyDistributionStorage is Initializable {
  // Members storage
  mapping(address => IEnergyDistribution.Member) internal members;
  address[] internal memberAddresses;

  // Device to member mapping
  mapping(uint256 => address) internal deviceToMember;

  // Allocated tokens per member from last distribution
  mapping(address => uint256) internal allocatedTokens;

  // Collective consumption list (sorted by price)
  IEnergyDistribution.CollectiveConsumption[] internal collectiveConsumption;

  // Negative cash credit balances (debts) - tokens handle positive balances
  mapping(address => int256) internal cashCreditBalances;

  // Export cash credit balance (when production > consumption)
  int256 internal exportCashCreditBalance;

  // NEW: Import cash credit balance (when community purchases grid energy)
  int256 internal importCashCreditBalance;

  // Total ownership percentage (should always be 10000)
  uint256 internal totalOwnershipPercentage;

  // Battery management
  uint256 internal batteryCurrentState;
  uint256 internal batteryPrice;
  uint256 internal batteryMaxCapacity;
  bool internal batteryConfigured;

  // Export device ID for special handling
  uint256 internal exportDeviceId;

  // Community device ID for receiving self-consumption payments
  uint256 internal communityDeviceId;

  // Export price per kWh (separate from production cost)
  uint256 internal exportPrice;

  // Settlement contract address for debt payments
  address internal settlementContract;

  // Settled balance tracking (external money brought into the system for debt settlement)
  int256 internal settledBalance;

  // Whitelist for permissioned functions
  mapping(address => bool) internal isWhitelisted;

  // ERC20 token for positive cash credit balances
  EnergyToken internal energyToken;

  // NEW: Community cash credit balance for self-consumption payments
  int256 internal communityCashCreditBalance;

  /**
   * @dev This empty reserved space is put in place to allow future versions to add new
   * variables without shifting down storage in the inheritance chain.
   */
  uint256[31] private __gap;
}
