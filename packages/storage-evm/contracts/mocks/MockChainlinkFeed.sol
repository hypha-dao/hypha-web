// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @dev Mock Chainlink AggregatorV3Interface for testing.
 * Allows setting price, decimals, and updatedAt timestamp.
 */
contract MockChainlinkFeed {
  int256 public price;
  uint8 public feedDecimals;
  uint256 public updatedAt;

  constructor(int256 _price, uint8 _decimals) {
    price = _price;
    feedDecimals = _decimals;
    updatedAt = block.timestamp;
  }

  function setPrice(int256 _price) external {
    price = _price;
    updatedAt = block.timestamp;
  }

  function setUpdatedAt(uint256 _updatedAt) external {
    updatedAt = _updatedAt;
  }

  function decimals() external view returns (uint8) {
    return feedDecimals;
  }

  function latestRoundData()
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 _updatedAt,
      uint80 answeredInRound
    )
  {
    return (1, price, block.timestamp, updatedAt, 1);
  }
}


