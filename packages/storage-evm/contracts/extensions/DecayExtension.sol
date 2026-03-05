// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '../interfaces/ITokenExtension.sol';
import '../interfaces/IDAOSpaceFactory.sol';
import '../libs/DecayLib.sol';

/**
 * @title DecayExtension
 * @dev Time-based balance decay. Deployed as a clone (EIP-1167) per token.
 *      Stores all decay state independently from the token contract.
 *
 *      - beforeTransfer: materializes pending decay (burns tokens via callback)
 *      - afterTransfer: tracks new token holders
 *      - adjustedBalanceOf: returns the decayed balance for view calls
 *      - applyDecay / getDecayedTotalSupply: public decay utilities
 */
contract DecayExtension is
  Initializable,
  ITokenExtension,
  IBalanceOfModifier
{
  address public token;

  uint256 public decayPercentage;
  uint256 public decayRate;
  mapping(address => uint256) public lastApplied;
  address[] private _tokenHolders;
  mapping(address => bool) private _isTokenHolder;
  uint256 public totalBurnedFromDecay;

  event DecayApplied(
    address indexed user,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 decayAmount
  );

  function initialize(
    uint256 _decayPercentage,
    uint256 _decayInterval
  ) external initializer {
    require(
      _decayPercentage > 0 && _decayPercentage <= 10000,
      'Invalid decay percentage'
    );
    require(_decayInterval > 0, 'Decay interval must be positive');
    decayPercentage = _decayPercentage;
    decayRate = _decayInterval;
  }

  function setToken(address _token) external override {
    require(token == address(0), 'Already linked');
    token = _token;
  }

  modifier onlyToken() {
    require(msg.sender == token, 'Only token');
    _;
  }

  modifier onlyExecutor() {
    require(
      msg.sender == ISpaceTokenBase(token).executor(),
      'Only executor'
    );
    _;
  }

  // =========================================================================
  // IBalanceOfModifier — called by token.balanceOf()
  // =========================================================================

  function adjustedBalanceOf(
    address account,
    uint256 rawBalance
  ) external view override returns (uint256) {
    if (
      ISpaceTokenBase(token).archived() ||
      decayRate == 0 ||
      rawBalance == 0 ||
      lastApplied[account] == 0
    ) {
      return rawBalance;
    }
    return
      DecayLib.computeDecayedBalance(
        rawBalance,
        lastApplied[account],
        decayPercentage,
        decayRate
      );
  }

  // =========================================================================
  // ITokenExtension hooks — called by token during transfer/mint
  // =========================================================================

  function beforeTransfer(
    address from,
    address to,
    uint256 /* amount */
  ) external override onlyToken {
    _materializeDecay(from);
    _materializeDecay(to);
  }

  function afterTransfer(
    address /* from */,
    address to,
    uint256 /* amount */
  ) external override onlyToken {
    _addTokenHolder(to);
  }

  function beforeMint(
    address to,
    uint256 /* amount */
  ) external override onlyToken {
    if (lastApplied[to] == 0) {
      lastApplied[to] = block.timestamp;
    } else {
      _materializeDecay(to);
    }
    _addTokenHolder(to);
  }

  // =========================================================================
  // Public decay functions
  // =========================================================================

  function applyDecay(address account) external {
    if (decayRate == 0) {
      lastApplied[account] = block.timestamp;
      return;
    }
    _materializeDecay(account);
  }

  function getDecayedTotalSupply() external view returns (uint256) {
    uint256 total = 0;
    for (uint256 i = 0; i < _tokenHolders.length; i++) {
      address holder = _tokenHolders[i];
      if (_isTokenHolder[holder]) {
        total += ISpaceTokenBase(token).balanceOf(holder);
      }
    }
    return total;
  }

  /**
   * @dev Reset timestamps for all holders. Called by executor when unarchiving
   *      to prevent retroactive decay during the archived period.
   */
  function resetTimestamps() external onlyExecutor {
    for (uint256 i = 0; i < _tokenHolders.length; i++) {
      address holder = _tokenHolders[i];
      if (_isTokenHolder[holder] && lastApplied[holder] > 0) {
        lastApplied[holder] = block.timestamp;
      }
    }
  }

  // =========================================================================
  // Internal
  // =========================================================================

  function _materializeDecay(address account) internal {
    ISpaceTokenBase _token = ISpaceTokenBase(token);
    uint256 raw = _token.rawBalanceOf(account);
    if (raw == 0 || lastApplied[account] == 0) {
      if (lastApplied[account] == 0 && raw > 0) {
        lastApplied[account] = block.timestamp;
      }
      return;
    }
    uint256 decayed = DecayLib.computeDecayedBalance(
      raw,
      lastApplied[account],
      decayPercentage,
      decayRate
    );
    lastApplied[account] = block.timestamp;
    if (decayed < raw) {
      uint256 burnAmount = raw - decayed;
      _token.extensionBurn(account, burnAmount);
      totalBurnedFromDecay += burnAmount;
      emit DecayApplied(account, raw, decayed, burnAmount);
    }
  }

  function _addTokenHolder(address account) internal {
    if (!_isTokenHolder[account] && account != address(0)) {
      _isTokenHolder[account] = true;
      _tokenHolders.push(account);
    }
  }
}
