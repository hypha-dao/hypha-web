// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './DecayingSpaceToken.sol';

/**
 * @title RNDAODecayingSpaceToken
 * @dev A decaying space token that allows the owner to manage transfer and receive whitelists
 */
contract RNDAODecayingSpaceToken is DecayingSpaceToken {
  /**
   * @dev Batch update transfer whitelist (executor or owner)
   * @param accounts Array of addresses to update
   * @param allowed Array of corresponding permission values
   */
  function batchSetTransferWhitelist(
    address[] calldata accounts,
    bool[] calldata allowed
  ) external override {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can update whitelist'
    );
    require(accounts.length == allowed.length, 'Array lengths must match');

    for (uint256 i = 0; i < accounts.length; i++) {
      canTransfer[accounts[i]] = allowed[i];
      emit TransferWhitelistUpdated(accounts[i], allowed[i]);
    }
  }

  /**
   * @dev Batch update receive whitelist (executor or owner)
   * @param accounts Array of addresses to update
   * @param allowed Array of corresponding permission values
   */
  function batchSetReceiveWhitelist(
    address[] calldata accounts,
    bool[] calldata allowed
  ) external override {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can update whitelist'
    );
    require(accounts.length == allowed.length, 'Array lengths must match');

    for (uint256 i = 0; i < accounts.length; i++) {
      canReceive[accounts[i]] = allowed[i];
      emit ReceiveWhitelistUpdated(accounts[i], allowed[i]);
    }
  }

  /**
   * @dev Enable or disable transfer whitelist enforcement (executor or owner)
   * @param enabled Whether to enforce transfer whitelist
   */
  function setUseTransferWhitelist(bool enabled) external override {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can update whitelist settings'
    );
    useTransferWhitelist = enabled;
    emit UseTransferWhitelistUpdated(enabled);
  }

  /**
   * @dev Enable or disable receive whitelist enforcement (executor or owner)
   * @param enabled Whether to enforce receive whitelist
   */
  function setUseReceiveWhitelist(bool enabled) external override {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can update whitelist settings'
    );
    useReceiveWhitelist = enabled;
    emit UseReceiveWhitelistUpdated(enabled);
  }
}
