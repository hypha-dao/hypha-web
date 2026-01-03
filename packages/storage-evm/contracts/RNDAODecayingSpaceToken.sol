// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './DecayingSpaceToken.sol';

/**
 * @title RNDAODecayingSpaceToken
 * @dev A decaying space token that allows the owner to manage transfer and receive whitelists
 */
contract RNDAODecayingSpaceToken is DecayingSpaceToken {
  /**
   * @dev Set whether the token is transferable (executor or owner)
   * @param _transferable Whether transfers are enabled
   */
  function setTransferable(bool _transferable) external override {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can update transferable'
    );
    transferable = _transferable;
    emit TransferableUpdated(_transferable);
  }

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

  /**
   * @dev Batch add spaces to transfer whitelist (executor or owner)
   * @param spaceIds Array of space IDs to add
   */
  function batchAddTransferWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external override {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can update whitelist'
    );

    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (!isTransferWhitelistedSpace[spaceIds[i]]) {
        isTransferWhitelistedSpace[spaceIds[i]] = true;
        _transferWhitelistedSpaceIds.push(spaceIds[i]);
        emit TransferWhitelistSpaceAdded(spaceIds[i]);
      }
    }
  }

  /**
   * @dev Batch add spaces to receive whitelist (executor or owner)
   * @param spaceIds Array of space IDs to add
   */
  function batchAddReceiveWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external override {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can update whitelist'
    );

    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (!isReceiveWhitelistedSpace[spaceIds[i]]) {
        isReceiveWhitelistedSpace[spaceIds[i]] = true;
        _receiveWhitelistedSpaceIds.push(spaceIds[i]);
        emit ReceiveWhitelistSpaceAdded(spaceIds[i]);
      }
    }
  }

  /**
   * @dev Batch remove spaces from transfer whitelist (executor or owner)
   * @param spaceIds Array of space IDs to remove
   */
  function batchRemoveTransferWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external override {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can update whitelist'
    );

    for (uint256 j = 0; j < spaceIds.length; j++) {
      uint256 _spaceId = spaceIds[j];
      if (isTransferWhitelistedSpace[_spaceId]) {
        isTransferWhitelistedSpace[_spaceId] = false;
        // Remove from array (swap and pop)
        for (uint256 i = 0; i < _transferWhitelistedSpaceIds.length; i++) {
          if (_transferWhitelistedSpaceIds[i] == _spaceId) {
            _transferWhitelistedSpaceIds[i] = _transferWhitelistedSpaceIds[
              _transferWhitelistedSpaceIds.length - 1
            ];
            _transferWhitelistedSpaceIds.pop();
            break;
          }
        }
        emit TransferWhitelistSpaceRemoved(_spaceId);
      }
    }
  }

  /**
   * @dev Batch remove spaces from receive whitelist (executor or owner)
   * @param spaceIds Array of space IDs to remove
   */
  function batchRemoveReceiveWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external override {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can update whitelist'
    );

    for (uint256 j = 0; j < spaceIds.length; j++) {
      uint256 _spaceId = spaceIds[j];
      if (isReceiveWhitelistedSpace[_spaceId]) {
        isReceiveWhitelistedSpace[_spaceId] = false;
        // Remove from array (swap and pop)
        for (uint256 i = 0; i < _receiveWhitelistedSpaceIds.length; i++) {
          if (_receiveWhitelistedSpaceIds[i] == _spaceId) {
            _receiveWhitelistedSpaceIds[i] = _receiveWhitelistedSpaceIds[
              _receiveWhitelistedSpaceIds.length - 1
            ];
            _receiveWhitelistedSpaceIds.pop();
            break;
          }
        }
        emit ReceiveWhitelistSpaceRemoved(_spaceId);
      }
    }
  }
}
