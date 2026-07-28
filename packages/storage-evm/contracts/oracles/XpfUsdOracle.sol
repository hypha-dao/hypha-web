// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @dev Chainlink AggregatorV3Interface.
 */
interface IAggregatorV3 {
  function decimals() external view returns (uint8);

  function description() external view returns (string memory);

  function version() external view returns (uint256);

  function getRoundData(
    uint80 _roundId
  )
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    );

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
}

/**
 * @title XpfUsdOracle
 * @dev Chainlink-compatible XPF/USD price feed derived from an EUR/USD feed.
 *
 * Chainlink does not publish an XPF/USD feed. The CFP franc has been pegged to
 * the euro since 1999 at the parity set by the Institut d'émission d'outre-mer:
 *
 *   1000 XPF = 8.38 EUR   (~119.3317 XPF per EUR)
 *
 * so a live XPF/USD rate can be synthesised from EUR/USD:
 *
 *   XPF/USD = EUR/USD * 838 / 100000
 *
 * Round metadata (roundId, startedAt, updatedAt, answeredInRound) is forwarded
 * unchanged from the underlying EUR/USD feed, so consumer staleness checks
 * behave exactly as they would against Chainlink directly. `decimals()` also
 * mirrors the underlying feed (8 for EUR/USD on Base).
 *
 * The peg is a compile-time constant and the underlying feed is immutable. If
 * the CFP franc is ever repegged, deploy a new adapter and repoint consumers.
 */
contract XpfUsdOracle {
  /// @dev Official CFP franc parity: 1000 XPF = 8.38 EUR.
  int256 public constant PEG_EUR_NUMERATOR = 838;
  int256 public constant PEG_EUR_DENOMINATOR = 100000;

  /// @dev Underlying Chainlink EUR/USD feed.
  IAggregatorV3 public immutable EUR_USD_FEED;

  uint8 private immutable FEED_DECIMALS;

  constructor(address eurUsdFeed) {
    require(eurUsdFeed != address(0), 'Invalid EUR/USD feed');
    EUR_USD_FEED = IAggregatorV3(eurUsdFeed);
    FEED_DECIMALS = IAggregatorV3(eurUsdFeed).decimals();
  }

  function decimals() external view returns (uint8) {
    return FEED_DECIMALS;
  }

  function description() external pure returns (string memory) {
    return 'XPF / USD';
  }

  function version() external pure returns (uint256) {
    return 1;
  }

  function latestRoundData()
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
  {
    (roundId, answer, startedAt, updatedAt, answeredInRound) = EUR_USD_FEED
      .latestRoundData();
    answer = _eurToXpf(answer);
  }

  function getRoundData(
    uint80 _roundId
  )
    external
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
  {
    (roundId, answer, startedAt, updatedAt, answeredInRound) = EUR_USD_FEED
      .getRoundData(_roundId);
    answer = _eurToXpf(answer);
  }

  /**
   * @dev Convert an EUR/USD answer to XPF/USD at the fixed peg, keeping the
   * source feed's decimals. Reverts rather than returning a non-positive
   * answer, which downstream consumers treat as an oracle failure anyway.
   */
  function _eurToXpf(int256 eurUsdAnswer) internal pure returns (int256) {
    require(eurUsdAnswer > 0, 'Invalid EUR/USD price');
    int256 xpfUsdAnswer = (eurUsdAnswer * PEG_EUR_NUMERATOR) /
      PEG_EUR_DENOMINATOR;
    require(xpfUsdAnswer > 0, 'XPF/USD price underflow');
    return xpfUsdAnswer;
  }
}
