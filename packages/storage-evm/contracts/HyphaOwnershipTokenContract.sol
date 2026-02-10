// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './OwnershipSpaceToken.sol';

/**
 * @title HyphaOwnershipTokenContract
 * @dev Extends OwnershipSpaceToken to allow the contract owner to mint and burn
 *      tokens without requiring executor role.
 *      When the owner mints, the space membership check is bypassed.
 *      When the owner burns, no approval is needed.
 */
contract HyphaOwnershipTokenContract is OwnershipSpaceToken {
  /**
   * @dev Override mint to allow both executor and owner to mint
   * When owner is minting, the space member check is bypassed
   */
  function mint(address to, uint256 amount) public override {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can mint'
    );
    require(!archived, 'Token is archived');

    // If executor is minting, enforce space member check (unless minting to executor)
    // If owner is minting, bypass space member check
    if (msg.sender == executor) {
      require(
        _isSpaceMember(to) || to == executor,
        'Can only mint to space members or executor'
      );
    }
    // Owner can mint to anyone - no space member check required

    // Check against maximum supply
    require(
      maxSupply == 0 || totalSupply() + amount <= maxSupply,
      'Mint would exceed max supply'
    );

    _mint(to, amount);
  }

  /**
   * @dev Burn tokens from any address (executor OR owner can burn without approval)
   * @param from The address to burn from
   * @param amount The amount to burn
   */
  function burnFrom(address from, uint256 amount) public virtual override {
    if (msg.sender == executor || msg.sender == owner()) {
      // Executor or owner can burn without approval
      _burn(from, amount);
      emit TokensBurned(msg.sender, from, amount);
    } else {
      // Others need approval
      super.burnFrom(from, amount);
      emit TokensBurned(msg.sender, from, amount);
    }
  }
}

