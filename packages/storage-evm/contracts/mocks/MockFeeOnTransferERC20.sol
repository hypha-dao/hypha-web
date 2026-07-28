// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/**
 * @dev ERC20 that burns a fee on every transfer, so the recipient receives less
 *      than the sender sent. Used to verify that balance-based accounting
 *      rejects fee-on-transfer tokens instead of mispricing them.
 */
contract MockFeeOnTransferERC20 is ERC20 {
  uint8 private _decimals;
  uint256 public feeBps;

  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals_,
    uint256 feeBps_
  ) ERC20(name, symbol) {
    _decimals = decimals_;
    feeBps = feeBps_;
  }

  function decimals() public view override returns (uint8) {
    return _decimals;
  }

  function mint(address to, uint256 amount) public {
    _mint(to, amount);
  }

  function setFeeBps(uint256 feeBps_) external {
    feeBps = feeBps_;
  }

  function _update(address from, address to, uint256 value) internal override {
    if (from != address(0) && to != address(0) && feeBps > 0) {
      uint256 fee = (value * feeBps) / 10_000;
      if (fee > 0) {
        super._update(from, address(0), fee);
        super._update(from, to, value - fee);
        return;
      }
    }
    super._update(from, to, value);
  }
}
