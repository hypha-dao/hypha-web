// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/**
 * @dev ERC20 that re-enters a target contract while it is mid-transfer. Used to
 *      verify that reentrancy guards on the target actually hold.
 *
 *      Arm it with the call to attempt, then trigger a transfer out of `target`.
 *      The re-entrant call's outcome is recorded rather than bubbled, so a test
 *      can assert that the guard rejected it while the outer call still
 *      completed normally.
 */
contract MockReentrantERC20 is ERC20 {
  uint8 private _decimals;

  address public target;
  bytes public payload;
  bool public armed;

  bool public reentryAttempted;
  bool public reentrySucceeded;

  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals_
  ) ERC20(name, symbol) {
    _decimals = decimals_;
  }

  function decimals() public view override returns (uint8) {
    return _decimals;
  }

  function mint(address to, uint256 amount) public {
    _mint(to, amount);
  }

  function arm(address target_, bytes calldata payload_) external {
    target = target_;
    payload = payload_;
    armed = true;
    reentryAttempted = false;
    reentrySucceeded = false;
  }

  function _update(address from, address to, uint256 value) internal override {
    // Re-enter while the target is paying out, i.e. inside its own call frame.
    if (armed && from == target) {
      armed = false;
      reentryAttempted = true;
      // solhint-disable-next-line avoid-low-level-calls
      (bool ok, ) = target.call(payload);
      reentrySucceeded = ok;
    }
    super._update(from, to, value);
  }
}
