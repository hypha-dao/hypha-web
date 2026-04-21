// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/**
 * @dev ERC20 used to simulate misbehaving tokens in tests:
 *      - `failTransfersTo` reverts when transferring to a specific address
 *        (mimics blacklist tokens like USDC).
 *      - `failAllTransfers` reverts on every `transfer` call (mimics paused
 *        / broken token).
 */
contract MockRevertingERC20 is ERC20 {
  uint8 private _decimals;
  address public failTransfersTo;
  bool public failAllTransfers;

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

  function setFailTransfersTo(address target) external {
    failTransfersTo = target;
  }

  function setFailAllTransfers(bool fail) external {
    failAllTransfers = fail;
  }

  function _update(
    address from,
    address to,
    uint256 value
  ) internal override {
    if (from != address(0) && to != address(0)) {
      // Only intercept actual transfers, not mints/burns.
      require(!failAllTransfers, 'MockRevertingERC20: transfers disabled');
      require(
        to != failTransfersTo || failTransfersTo == address(0),
        'MockRevertingERC20: blacklisted recipient'
      );
    }
    super._update(from, to, value);
  }
}
