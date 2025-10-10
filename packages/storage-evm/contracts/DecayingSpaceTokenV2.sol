// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './DecayingSpaceToken.sol';

contract DecayingSpaceTokenV2 is DecayingSpaceToken {
  uint256 public extraFeature;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initializeV2(uint256 _extraFeature) public reinitializer(2) {
    extraFeature = _extraFeature;
  }

  function version() public pure returns (string memory) {
    return 'V2';
  }
}
