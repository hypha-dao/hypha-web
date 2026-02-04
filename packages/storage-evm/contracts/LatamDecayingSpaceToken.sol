// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './DecayingSpaceToken.sol';

/**
 * @title LatamDecayingSpaceToken
 * @dev A decaying space token that allows the executor or owner to change decay parameters
 */
contract LatamDecayingSpaceToken is DecayingSpaceToken {
  event DecayRateUpdated(uint256 oldRate, uint256 newRate);
  event DecayPercentageUpdated(uint256 oldPercentage, uint256 newPercentage);

  /**
   * @dev Set the decay rate (interval in seconds). Set to 0 to disable decay.
   * @param _decayRate New decay interval in seconds (0 = no decay)
   */
  function setDecayRate(uint256 _decayRate) external {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can update decay rate'
    );

    uint256 oldRate = decayRate;
    decayRate = _decayRate;
    emit DecayRateUpdated(oldRate, _decayRate);
  }

  /**
   * @dev Set the decay percentage
   * @param _decayPercentage New decay percentage in basis points (0-10000)
   */
  function setDecayPercentage(uint256 _decayPercentage) external {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can update decay percentage'
    );
    require(_decayPercentage <= 10000, 'Decay percentage cannot exceed 100%');

    uint256 oldPercentage = decayPercentage;
    decayPercentage = _decayPercentage;
    emit DecayPercentageUpdated(oldPercentage, _decayPercentage);
  }
}
