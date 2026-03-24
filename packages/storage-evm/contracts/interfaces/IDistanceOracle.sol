// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDistanceOracle {
  /// @notice Validate that producer and consumer GPS coordinates satisfy
  ///         the national REC distance rule for the given country and voltage level.
  /// @param gpsLatProducer  Producer latitude  (×1e6 fixed-point)
  /// @param gpsLonProducer  Producer longitude (×1e6 fixed-point)
  /// @param gpsLatConsumer  Consumer latitude  (×1e6 fixed-point)
  /// @param gpsLonConsumer  Consumer longitude (×1e6 fixed-point)
  /// @param countryCode     ISO 3166-1 alpha-2 packed into bytes2 (e.g. 0x4E4C = "NL")
  /// @param voltageLevel    0 = LV, 1 = MV, 2 = HV, 3 = EHV
  function validate(
    int64 gpsLatProducer,
    int64 gpsLonProducer,
    int64 gpsLatConsumer,
    int64 gpsLonConsumer,
    bytes2 countryCode,
    uint8 voltageLevel
  ) external view returns (bool);
}
