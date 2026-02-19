// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './RegularSpaceToken.sol';

/**
 * @title HyphaEnergyCreditContract
 * @dev Extends RegularSpaceToken to allow the contract owner to burn tokens
 *      from any address without requiring approval, in addition to the executor.
 */
contract HyphaEnergyCreditContract is RegularSpaceToken {
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


