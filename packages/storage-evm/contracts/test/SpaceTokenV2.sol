// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../RegularSpaceToken.sol';

contract SpaceTokenV2 is SpaceToken {
  uint256 public constant extraFeature = 42;

  function version() public pure returns (string memory) {
    return 'V2';
  }
}
