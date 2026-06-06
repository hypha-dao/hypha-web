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

  // Reserved storage slots for upgrade-safe additions to this contract. Decrement
  // when appending a new state variable above so any contract inheriting
  // DecayingSpaceToken keeps a fixed storage layout.
  uint256[50] private __gap;

  event DecayApplied(
    address indexed user,
    uint256 oldBalance,
    uint256 newBalance,
    uint256 decayAmount
  );
  event DecayPercentageUpdated(
    uint256 oldDecayPercentage,
    uint256 newDecayPercentage
  );
  event DecayIntervalUpdated(uint256 oldDecayInterval, uint256 newDecayInterval);

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
    bool _fixedMaxSupply,
    bool _autoMinting,
    uint256 _tokenPrice,
    address _priceCurrencyFeed,
    bool _useTransferWhitelist,
    bool _useReceiveWhitelist,
    address[] memory _initialTransferWhitelist,
    address[] memory _initialReceiveWhitelist,
    uint256[] memory _initialTransferWhitelistSpaceIds,
    uint256[] memory _initialReceiveWhitelistSpaceIds,
    uint256 _decayPercentage,
    uint256 _decayInterval,
    address _paymentToken,
    uint256 _paymentTokenPricePerToken,
    uint256 _tokensForSale,
    uint8 _purchaseEligibilityMode,
    uint256[] memory _initialPurchaseWhitelistSpaceIds,
    address[] memory _initialAuthorizedMinters
  ) public initializer {
    RegularSpaceToken.initialize(
      name,
      symbol,
      _executor,
      _spaceId,
      _maxSupply,
      _transferable,
      _fixedMaxSupply,
      _autoMinting,
      _tokenPrice,
      _priceCurrencyFeed,
      _useTransferWhitelist,
      _useReceiveWhitelist,
      _initialTransferWhitelist,
      _initialReceiveWhitelist,
      _initialTransferWhitelistSpaceIds,
      _initialReceiveWhitelistSpaceIds,
      0,
      new uint256[](0),
      _paymentToken,
      _paymentTokenPricePerToken,
      _tokensForSale,
      _purchaseEligibilityMode,
      _initialPurchaseWhitelistSpaceIds,
      _initialAuthorizedMinters
    );
    require(
      _decayPercentage <= 10000,
      'decay% > 100'
    );
    require(
      _decayInterval > 0,
      '!decay interval'
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

    // If token is archived or decay is not configured, return actual balance without decay
    if (archived || decayRate == 0) {
      return currentBalance;
    }

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
    // If token is archived or decay is not configured, update lastApplied but don't apply decay
    if (archived || decayRate == 0) {
      lastApplied[account] = block.timestamp;
      return;
    }

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
   * @dev Update decay percentage in basis points (0-10000)
   * @param _decayPercentage New decay percentage
   */
  function setDecayPercentage(uint256 _decayPercentage) external virtual {
    require(
      msg.sender == executor,
      '!executor'
    );
    require(
      _decayPercentage <= 10000,
      'decay% > 100'
    );

    uint256 oldDecayPercentage = decayPercentage;
    decayPercentage = _decayPercentage;

    emit DecayPercentageUpdated(oldDecayPercentage, _decayPercentage);
  }

  /**
   * @dev Update decay interval in seconds
   * @param _decayInterval New decay interval
   */
  function setDecayInterval(uint256 _decayInterval) external virtual {
    require(msg.sender == executor, '!executor');
    require(
      _decayInterval > 0,
      '!decay interval'
    );

    uint256 oldDecayInterval = decayRate;
    decayRate = _decayInterval;

    emit DecayIntervalUpdated(oldDecayInterval, _decayInterval);
  }

  function mint(address to, uint256 amount) public override {
    require(
      msg.sender == executor || isAuthorizedMinter[msg.sender],
      '!executor'
    );
    _applyDecayOrInit(to);
    _addTokenHolder(to);
    _mintWithSupplyChecks(to, amount);
  }

  function _applyDecayOrInit(address account) internal {
    if (lastApplied[account] == 0) {
      lastApplied[account] = block.timestamp;
    } else {
      applyDecay(account);
    }
  }

  function transfer(address to, uint256 amount) public override returns (bool) {
    address sender = _msgSender();
    _validateTransferAccess(sender, to, sender);
    applyDecay(sender);
    _autoMintIfNeeded(sender, amount);
    _applyDecayOrInit(to);
    _addTokenHolder(to);
    _transfer(sender, to, amount);
    return true;
  }

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public override returns (bool) {
    address spender = _msgSender();
    _validateTransferAccess(from, to, spender);
    applyDecay(from);
    _autoMintIfNeeded(from, amount);
    _applyDecayOrInit(to);
    _addTokenHolder(to);
    if (spender == transferHelper) {
    } else {
      _spendAllowance(from, spender, amount);
    }
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

  /**
   * @dev Override setArchived to update all token holders' lastApplied timestamps when unarchiving
   * This prevents decay from accumulating during the archived period
   */
  function setArchived(bool _archived) external override {
    require(msg.sender == executor, '!executor');

    // If we're unarchiving (going from true to false), update all holders' timestamps
    if (archived && !_archived) {
      // Update lastApplied for all token holders to prevent retroactive decay
      for (uint256 i = 0; i < _tokenHolders.length; i++) {
        address holder = _tokenHolders[i];
        if (_isTokenHolder[holder] && lastApplied[holder] > 0) {
          lastApplied[holder] = block.timestamp;
        }
      }
    }

    archived = _archived;
    emit ArchivedStatusUpdated(_archived);
  }
}
