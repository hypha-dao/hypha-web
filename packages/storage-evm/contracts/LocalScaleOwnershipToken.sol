// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './OwnershipSpaceToken.sol';

/**
 * @title LocalScaleOwnershipToken
 * @dev An ownership space token that gives the contract owner (in addition to executor)
 * the ability to mint, manage whitelists, and allows whitelisted addresses to transfer.
 *
 * Transfer logic:
 *   - Executor: can transfer to space members (with auto-mint). Receive whitelist enforced.
 *   - Whitelisted senders (useTransferWhitelist must be on): can transfer freely.
 *     Receive whitelist is still enforced on the recipient when enabled.
 *   - Everyone else: blocked.
 *
 * Whitelist management (setUseTransferWhitelist, batchSetTransferWhitelist, etc.)
 * accepts both executor AND owner, so the deployer/owner can configure whitelists
 * without needing the space executor key.
 */
contract LocalScaleOwnershipToken is OwnershipSpaceToken {
  /**
   * @dev Override mint to allow both executor and owner to mint.
   * When owner is minting, the space member check is bypassed.
   */
  function mint(address to, uint256 amount) public override {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can mint'
    );
    require(!archived, 'Token is archived');

    if (msg.sender == executor) {
      require(
        _isSpaceMember(to) || to == executor,
        'Can only mint to space members or executor'
      );
    }

    require(
      maxSupply == 0 || totalSupply() + amount <= maxSupply,
      'Mint would exceed max supply'
    );

    _mint(to, amount);
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Transfer overrides — whitelisted addresses may transfer
  // ──────────────────────────────────────────────────────────────────────

  function transfer(
    address to,
    uint256 amount
  ) public override returns (bool) {
    address sender = _msgSender();
    require(!archived, 'Token is archived');

    // ── Executor path ──
    if (sender == executor) {
      if (autoMinting && balanceOf(sender) < amount) {
        uint256 amountToMint = amount - balanceOf(sender);
        mint(sender, amountToMint);
      }

      if (to != executor && useReceiveWhitelist) {
        require(
          canReceive[to] || _isInReceiveWhitelistedSpace(to),
          'Recipient not whitelisted to receive'
        );
      }

      require(_isSpaceMember(to), 'Can only transfer to space members');
      _transfer(sender, to, amount);
      return true;
    }

    // ── Whitelisted sender path ──
    require(
      useTransferWhitelist &&
        (canTransfer[sender] || _isInTransferWhitelistedSpace(sender)),
      'Sender not whitelisted to transfer'
    );

    if (to != executor && useReceiveWhitelist) {
      require(
        canReceive[to] || _isInReceiveWhitelistedSpace(to),
        'Recipient not whitelisted to receive'
      );
    }

    _transfer(sender, to, amount);
    return true;
  }

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public override returns (bool) {
    address spender = _msgSender();
    require(!archived, 'Token is archived');

    // ── Executor path ──
    if (spender == executor) {
      if (from == executor && autoMinting && balanceOf(from) < amount) {
        uint256 amountToMint = amount - balanceOf(from);
        mint(from, amountToMint);
      }

      if (to != executor && useReceiveWhitelist) {
        require(
          canReceive[to] || _isInReceiveWhitelistedSpace(to),
          'Recipient not whitelisted to receive'
        );
      }

      require(_isSpaceMember(to), 'Can only transfer to space members');
      _transfer(from, to, amount);
      return true;
    }

    // ── Escrow contract path ──
    if (spender == escrowContract && _isSpaceMember(to)) {
      _transfer(from, to, amount);
      return true;
    }

    // ── Transfer helper path ──
    if (spender == transferHelper) {
      require(_isSpaceMember(to), 'Can only transfer to space members');
      _transfer(from, to, amount);
      return true;
    }

    // ── Whitelisted sender path ──
    if (from != executor) {
      require(
        useTransferWhitelist &&
          (canTransfer[from] || _isInTransferWhitelistedSpace(from)),
        'Sender not whitelisted to transfer'
      );
    } else {
      if (autoMinting && balanceOf(from) < amount) {
        uint256 amountToMint = amount - balanceOf(from);
        mint(from, amountToMint);
      }
    }

    if (to != executor && useReceiveWhitelist) {
      require(
        canReceive[to] || _isInReceiveWhitelistedSpace(to),
        'Recipient not whitelisted to receive'
      );
    }

    _spendAllowance(from, spender, amount);
    _transfer(from, to, amount);
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────
  //  Whitelist management — owner OR executor
  // ──────────────────────────────────────────────────────────────────────

  function setUseTransferWhitelist(bool enabled) external override {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can update whitelist settings'
    );
    useTransferWhitelist = enabled;
    emit UseTransferWhitelistUpdated(enabled);
  }

  function setUseReceiveWhitelist(bool enabled) external override {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can update whitelist settings'
    );
    useReceiveWhitelist = enabled;
    emit UseReceiveWhitelistUpdated(enabled);
  }

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
}
