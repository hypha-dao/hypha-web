// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import './RegularSpaceToken.sol';

/**
 * @title DecayingSpaceToken
 * @dev A space token with configurable vote decay
 */
contract DecayingSpaceToken is Initializable, RegularSpaceToken {
  // Decay configuration
  uint256 public decayPercentage; // Decay percentage in basis points (0-10000)
  uint256 public decayRate; // Decay interval in seconds
  mapping(address => uint256) public lastApplied;

  // Track token holders for decayed total supply calculation
  address[] private _tokenHolders;
  mapping(address => bool) private _isTokenHolder;

  // Track total burned tokens from decay (keep this for informational purposes)
  uint256 public totalBurnedFromDecay;

  event DecayApplied(
    address indexed user,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 decayAmount
  );

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    string memory name,
    string memory symbol,
    address _executor,
    uint256 _spaceId,
    uint256 _maxSupply,
    bool _transferable,
    uint256 _decayPercentage,
    uint256 _decayInterval
  ) public initializer {
    RegularSpaceToken.initialize(
      name,
      symbol,
      _executor,
      _spaceId,
      _maxSupply,
      _transferable
    );
    require(
      _decayPercentage <= 10000,
      'DecayingSpaceToken: decay percentage cannot exceed 100%'
    );
    require(
      _decayInterval > 0,
      'DecayingSpaceToken: decay interval must be positive'
    );

    decayPercentage = _decayPercentage;
    decayRate = _decayInterval;
  }

  /**
   * @dev Add address to token holders if not already tracked
   */
  function _addTokenHolder(address account) internal {
    if (!_isTokenHolder[account] && account != address(0)) {
      _isTokenHolder[account] = true;
      _tokenHolders.push(account);
    }
  }

  /**
   * @dev Remove address from token holders if balance becomes zero
   */
  function _updateTokenHolderStatus(address account) internal {
    if (super.balanceOf(account) == 0 && _isTokenHolder[account]) {
      _isTokenHolder[account] = false;
      // Note: We don't remove from the array to avoid gas costs
      // The getDecayedTotalSupply function will check balances
    }
  }

  /**
   * @dev Returns the current balance including any pending decay
   * @param account The address to query the balance of
   * @return The current voting power after decay calculations
   */
  function balanceOf(address account) public view override returns (uint256) {
    uint256 currentBalance = super.balanceOf(account);
    if (currentBalance == 0 || lastApplied[account] == 0) {
      return currentBalance;
    }

    // Calculate decay since last update
    uint256 timeSinceLastDecay = block.timestamp - lastApplied[account];
    uint256 periodsPassed = timeSinceLastDecay / decayRate;

    if (periodsPassed == 0) {
      return currentBalance;
    }

    // Apply decay formula: balance * (1 - decayPercentage/10000)^periodsPassed
    uint256 factor = 10000 - decayPercentage; // e.g. 9900 for 1% decay
    uint256 acc = 10000; // 100%
    uint256 n = periodsPassed;
    while (n > 0) {
      if ((n & 1) == 1) {
        acc = (acc * factor) / 10000;
      }
      factor = (factor * factor) / 10000;
      n >>= 1;
    }

    return (currentBalance * acc) / 10000;
  }

  /**
   * @dev Applies any pending decay to an account and updates balances
   * @param account The address to apply decay to
   */
  function applyDecay(address account) public {
    uint256 oldBalance = super.balanceOf(account);
    uint256 newBalance = balanceOf(account);

    if (newBalance < oldBalance) {
      uint256 decayAmount = oldBalance - newBalance;

      // Burn the tokens, which automatically updates total supply
      _burn(account, decayAmount);

      // Update total burned from decay counter
      totalBurnedFromDecay += decayAmount;

      emit DecayApplied(account, oldBalance, newBalance, decayAmount);
    }

    lastApplied[account] = block.timestamp;
    _updateTokenHolderStatus(account);
  }

  /**
   * @dev Override mint to track lastDecayTimestamp and token holders
   */
  function mint(address to, uint256 amount) public override {
    require(msg.sender == executor, 'Only executor can mint');
    if (lastApplied[to] == 0) {
      lastApplied[to] = block.timestamp;
    } else {
      applyDecay(to); // Apply any pending decay first
    }
    _addTokenHolder(to);
    super.mint(to, amount);
  }

  /**
   * @dev Apply decay before transfers
   */
  function transfer(address to, uint256 amount) public override returns (bool) {
    address sender = _msgSender();
    require(transferable || sender == executor, 'Token transfers are disabled');
    applyDecay(sender);
    if (sender == executor) {
      if (super.balanceOf(sender) < amount) {
        uint256 amountToMint = amount - super.balanceOf(sender);
        mint(sender, amountToMint);
      }
    }

    if (lastApplied[to] == 0) {
      lastApplied[to] = block.timestamp;
    } else {
      applyDecay(to);
    }
    _addTokenHolder(to);
    _transfer(sender, to, amount);
    return true;
  }

  /**
   * @dev Apply decay before transferFrom
   */
  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public override returns (bool) {
    address spender = _msgSender();
    require(
      transferable || spender == executor,
      'Token transfers are disabled'
    );

    applyDecay(from);
    if (from == executor) {
      if (super.balanceOf(from) < amount) {
        uint256 amountToMint = amount - super.balanceOf(from);
        mint(from, amountToMint);
      }
    }

    if (lastApplied[to] == 0) {
      lastApplied[to] = block.timestamp;
    } else {
      applyDecay(to);
    }
    _addTokenHolder(to);

    _spendAllowance(from, spender, amount);
    _transfer(from, to, amount);
    return true;
  }

  /**
   * @dev Returns the total supply with decay applied to all balances
   * @return The current total supply after decay calculations
   */
  function getDecayedTotalSupply() public view returns (uint256) {
    uint256 totalDecayedSupply = 0;

    for (uint256 i = 0; i < _tokenHolders.length; i++) {
      address holder = _tokenHolders[i];
      if (_isTokenHolder[holder]) {
        totalDecayedSupply += balanceOf(holder);
      }
    }

    return totalDecayedSupply;
  }
}
