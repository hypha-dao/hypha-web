// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '../interfaces/IEnergyPPA.sol';
import '../EnergyToken.sol';

contract EnergyPPAStorage is Initializable {
  // ── Members ────────────────────────────────────────────────────────────
  mapping(address => IEnergyPPA.MemberPPA) internal members;
  address[] internal memberAddresses;
  mapping(uint256 => address) internal deviceToMember;
  uint256 internal totalOwnershipBps;

  // ── Balances ───────────────────────────────────────────────────────────
  mapping(address => int256) internal cashCreditBalances;
  int256 internal importCashCreditBalance;
  int256 internal exportCashCreditBalance;
  int256 internal settledBalance;

  // ── Revenue split ──────────────────────────────────────────────────────
  address internal communityAddress;
  address internal aggregatorAddress;
  uint16 internal communityFeeBps; // basis points taken from local revenue
  uint16 internal aggregatorFeeBps;

  // ── Config ─────────────────────────────────────────────────────────────
  uint256 internal exportDeviceId;
  uint256 internal exportPrice;

  // ── Settlement ─────────────────────────────────────────────────────────
  address internal stablecoinAddress;
  address internal paymentRecipient;

  // ── Access ─────────────────────────────────────────────────────────────
  mapping(address => bool) internal isWhitelisted;
  EnergyToken internal energyToken;

  uint256[35] private __gap;
}
