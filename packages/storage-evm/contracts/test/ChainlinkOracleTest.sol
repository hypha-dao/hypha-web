// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ChainlinkOracleTest
 * @dev Simple contract to test Chainlink price feeds on Base.
 * Deploy this first, then call readPrice() with any Chainlink feed address
 * to verify the oracle works and returns a valid price.
 */

interface IAggregatorV3 {
  function latestRoundData()
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    );

  function decimals() external view returns (uint8);

  function description() external view returns (string memory);
}

contract ChainlinkOracleTest {
  struct PriceResult {
    string description;
    int256 price;
    uint8 decimals;
    uint256 updatedAt;
    uint256 stalenessSeconds;
    bool isStale;
  }

  uint256 public constant STALENESS_THRESHOLD = 24 hours;

  /**
   * @dev Read a single Chainlink price feed. Returns all relevant data.
   */
  function readPrice(
    address feed
  ) external view returns (PriceResult memory result) {
    IAggregatorV3 agg = IAggregatorV3(feed);

    (, int256 answer, , uint256 updatedAt, ) = agg.latestRoundData();

    result.description = agg.description();
    result.price = answer;
    result.decimals = agg.decimals();
    result.updatedAt = updatedAt;
    result.stalenessSeconds = block.timestamp > updatedAt
      ? block.timestamp - updatedAt
      : 0;
    result.isStale = result.stalenessSeconds > STALENESS_THRESHOLD;
  }

  /**
   * @dev Read multiple Chainlink feeds at once. Useful for batch testing.
   */
  function readPrices(
    address[] calldata feeds
  ) external view returns (PriceResult[] memory results) {
    results = new PriceResult[](feeds.length);
    for (uint256 i = 0; i < feeds.length; i++) {
      try this.readPrice(feeds[i]) returns (PriceResult memory r) {
        results[i] = r;
      } catch {
        results[i].description = 'FAILED';
        results[i].price = 0;
      }
    }
  }
}
