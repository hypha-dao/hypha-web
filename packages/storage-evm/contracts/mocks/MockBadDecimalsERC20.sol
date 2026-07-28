// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/**
 * @dev ERC20 whose `decimals()` misbehaves, to check that callers reading token
 *      metadata degrade gracefully. Modes:
 *      0 — returns a nonsensically large value
 *      1 — returns fewer than 32 bytes, so the result cannot be ABI-decoded
 *      2 — reverts
 */
contract MockBadDecimalsERC20 is ERC20 {
  uint8 public mode;

  constructor(uint8 mode_) ERC20('Bad', 'BAD') {
    mode = mode_;
  }

  function mint(address to, uint256 amount) public {
    _mint(to, amount);
  }

  function decimals() public view override returns (uint8) {
    uint8 m = mode;
    if (m == 0) {
      // Report 999, which no real token uses, via a wider return type.
      assembly {
        mstore(0, 999)
        return(0, 32)
      }
    }
    if (m == 1) {
      assembly {
        mstore(0, 6)
        return(0, 4)
      }
    }
    revert('MockBadDecimalsERC20: no decimals');
  }
}
