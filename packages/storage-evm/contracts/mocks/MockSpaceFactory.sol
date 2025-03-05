// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockSpaceFactory {
  function isMember(uint256, address) external pure returns (bool) {
    return true;
  }

  function getSpaceDetails(
    uint256
  )
    external
    pure
    returns (
      uint256 unity,
      uint256 quorum,
      uint256 votingPowerSource,
      address[] memory tokenAddresses,
      address[] memory members,
      uint256 exitMethod,
      uint256 joinMethod,
      uint256 createdAt,
      address creator,
      address executor
    )
  {
    return (
      51,
      51,
      1,
      new address[](0),
      new address[](0),
      1,
      1,
      0,
      address(0),
      address(1)
    );
  }

  function getSpaceExecutor(uint256) external pure returns (address) {
    return address(1);
  }

  function getSpaceMemberAddresses(
    uint256
  ) external pure returns (address[] memory) {
    return new address[](0);
  }
}
