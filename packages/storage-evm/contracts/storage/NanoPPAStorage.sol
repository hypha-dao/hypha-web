// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '../interfaces/INanoPPA.sol';
import '../interfaces/IDistanceOracle.sol';

contract NanoPPAStorage is Initializable {
  // ── Agreement storage ──────────────────────────────────────────────────

  mapping(bytes32 => INanoPPA.Agreement) internal agreements;
  bytes32[] internal agreementIds;

  // ── Indexes ────────────────────────────────────────────────────────────

  mapping(address => bytes32[]) internal producerAgreements;
  mapping(address => bytes32[]) internal consumerAgreements;

  // ── Settlement tracking ────────────────────────────────────────────────

  mapping(bytes32 => uint256) internal lastSettledInterval;
  mapping(bytes32 => uint8) internal consecutiveMissing;

  // ── Access control ─────────────────────────────────────────────────────

  mapping(address => bool) internal isOracle;

  // ── Configuration ──────────────────────────────────────────────────────

  IDistanceOracle internal distanceOracle;
  address internal defaultAggregator;
  address internal defaultStablecoin;
  address internal membershipValidator;

  /**
   * @dev Reserved storage gap for future upgrades.
   */
  uint256[40] private __gap;
}
