// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import './RegularSpaceToken.sol';

/**
 * @title MutualCreditSpaceToken
 * @dev A space token with mutual credit mechanics. Members of whitelisted spaces
 * can spend beyond their balance up to a credit limit. Tokens are minted on deficit
 * and burned on repayment, keeping totalSupply equal to total outstanding credit.
 *
 * Credit eligibility is determined by:
 *   1. Per-address custom credit limits (highest priority)
 *   2. Membership in credit-whitelisted spaces → receives defaultCreditLimit
 *   3. Otherwise → no credit (limit = 0)
 */
contract MutualCreditSpaceToken is Initializable, RegularSpaceToken {
  // --- Mutual credit storage (appended for UUPS upgradeability) ---

  uint256 public defaultCreditLimit;

  mapping(address => uint256) public creditBalanceOf;
  mapping(address => uint256) public customCreditLimit;
  mapping(address => bool) public hasCustomCreditLimit;

  uint256[] internal _creditWhitelistedSpaceIds;
  mapping(uint256 => bool) public isCreditWhitelistedSpace;

  // --- Events ---

  event DefaultCreditLimitUpdated(uint256 oldLimit, uint256 newLimit);
  event CreditLimitSet(address indexed member, uint256 limit);
  event CreditLimitRemoved(address indexed member);
  event CreditUsed(
    address indexed member,
    uint256 amount,
    uint256 newCreditBalance
  );
  event CreditRepaid(
    address indexed member,
    uint256 amount,
    uint256 newCreditBalance
  );
  event CreditForgiven(
    address indexed member,
    uint256 amount,
    uint256 newCreditBalance
  );
  event CreditWhitelistSpaceAdded(uint256 indexed spaceId);
  event CreditWhitelistSpaceRemoved(uint256 indexed spaceId);

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
    uint256 _defaultCreditLimit,
    uint256[] memory _initialCreditWhitelistSpaceIds
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
      _initialReceiveWhitelist
    );

    defaultCreditLimit = _defaultCreditLimit;

    for (uint256 i = 0; i < _initialCreditWhitelistSpaceIds.length; i++) {
      uint256 sid = _initialCreditWhitelistSpaceIds[i];
      if (!isCreditWhitelistedSpace[sid]) {
        isCreditWhitelistedSpace[sid] = true;
        _creditWhitelistedSpaceIds.push(sid);
      }
    }
  }

  // =========================================================================
  // Credit view functions
  // =========================================================================

  /**
   * @dev Resolved credit limit for an account. Custom limit takes priority,
   * then membership in a credit-whitelisted space yields the default limit.
   */
  function creditLimitOf(address account) public view returns (uint256) {
    if (hasCustomCreditLimit[account]) {
      return customCreditLimit[account];
    }
    if (_isInCreditWhitelistedSpace(account)) {
      return defaultCreditLimit;
    }
    return 0;
  }

  /**
   * @dev Remaining credit an account can still use before hitting its limit.
   */
  function creditLimitLeftOf(address account) public view returns (uint256) {
    uint256 limit = creditLimitOf(account);
    uint256 used = creditBalanceOf[account];
    if (used >= limit) {
      return 0;
    }
    return limit - used;
  }

  /**
   * @dev Net position: positive means net creditor, negative means net debtor.
   */
  function netBalanceOf(address account) public view returns (int256) {
    return int256(balanceOf(account)) - int256(creditBalanceOf[account]);
  }

  function getCreditWhitelistedSpaces()
    external
    view
    returns (uint256[] memory)
  {
    return _creditWhitelistedSpaceIds;
  }

  // =========================================================================
  // Transfer overrides — inject credit mint/burn around _transfer
  // =========================================================================

  function transfer(
    address to,
    uint256 amount
  ) public override returns (bool) {
    address sender = _msgSender();
    require(!archived, 'Token is archived');
    require(transferable || sender == executor, 'Token transfers are disabled');

    if (sender != executor) {
      if (useTransferWhitelist) {
        require(
          canTransfer[sender] || _isInTransferWhitelistedSpace(sender),
          'Sender not whitelisted to transfer'
        );
      }
    }

    if (to != executor) {
      if (useReceiveWhitelist) {
        require(
          canReceive[to] || _isInReceiveWhitelistedSpace(to),
          'Recipient not whitelisted to receive'
        );
      }
    }

    if (sender == executor && autoMinting) {
      if (balanceOf(sender) < amount) {
        uint256 amountToMint = amount - balanceOf(sender);
        mint(sender, amountToMint);
      }
    }

    _beforeCreditTransfer(sender, amount);
    _transfer(sender, to, amount);
    _afterCreditTransfer(to, amount);
    return true;
  }

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public override returns (bool) {
    address spender = _msgSender();
    require(!archived, 'Token is archived');
    require(
      transferable || spender == executor,
      'Token transfers are disabled'
    );

    if (from != executor) {
      if (useTransferWhitelist) {
        require(
          canTransfer[from] || _isInTransferWhitelistedSpace(from),
          'Sender not whitelisted to transfer'
        );
      }
    }

    if (to != executor) {
      if (useReceiveWhitelist) {
        require(
          canReceive[to] || _isInReceiveWhitelistedSpace(to),
          'Recipient not whitelisted to receive'
        );
      }
    }

    if (from == executor && autoMinting) {
      if (balanceOf(from) < amount) {
        uint256 amountToMint = amount - balanceOf(from);
        mint(from, amountToMint);
      }
    }

    _beforeCreditTransfer(from, amount);

    if (spender == transferHelper) {
      // TransferHelper skips allowance — see RegularSpaceToken
    } else {
      _spendAllowance(from, spender, amount);
    }

    _transfer(from, to, amount);
    _afterCreditTransfer(to, amount);
    return true;
  }

  // =========================================================================
  // Credit administration (executor only)
  // =========================================================================

  function setDefaultCreditLimit(uint256 _limit) external {
    require(
      msg.sender == executor,
      'Only executor can update default credit limit'
    );
    uint256 old = defaultCreditLimit;
    defaultCreditLimit = _limit;
    emit DefaultCreditLimitUpdated(old, _limit);
  }

  function setCreditLimit(address member, uint256 limit) external {
    require(msg.sender == executor, 'Only executor can set credit limits');
    customCreditLimit[member] = limit;
    hasCustomCreditLimit[member] = true;
    emit CreditLimitSet(member, limit);
  }

  function removeCreditLimit(address member) external {
    require(msg.sender == executor, 'Only executor can remove credit limits');
    delete customCreditLimit[member];
    hasCustomCreditLimit[member] = false;
    emit CreditLimitRemoved(member);
  }

  /**
   * @dev Forgive outstanding credit debt without requiring token repayment.
   * Burns the equivalent amount from total supply to maintain the invariant.
   */
  function forgiveCredit(address member, uint256 amount) external {
    require(msg.sender == executor, 'Only executor can forgive credit');
    uint256 debt = creditBalanceOf[member];
    require(amount <= debt, 'Amount exceeds credit balance');
    creditBalanceOf[member] = debt - amount;
    emit CreditForgiven(member, amount, creditBalanceOf[member]);
  }

  function batchAddCreditWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external {
    require(
      msg.sender == executor,
      'Only executor can update credit whitelist'
    );
    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (!isCreditWhitelistedSpace[spaceIds[i]]) {
        isCreditWhitelistedSpace[spaceIds[i]] = true;
        _creditWhitelistedSpaceIds.push(spaceIds[i]);
        emit CreditWhitelistSpaceAdded(spaceIds[i]);
      }
    }
  }

  function batchRemoveCreditWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external {
    require(
      msg.sender == executor,
      'Only executor can update credit whitelist'
    );
    for (uint256 j = 0; j < spaceIds.length; j++) {
      uint256 sid = spaceIds[j];
      if (isCreditWhitelistedSpace[sid]) {
        isCreditWhitelistedSpace[sid] = false;
        for (uint256 i = 0; i < _creditWhitelistedSpaceIds.length; i++) {
          if (_creditWhitelistedSpaceIds[i] == sid) {
            _creditWhitelistedSpaceIds[i] = _creditWhitelistedSpaceIds[
              _creditWhitelistedSpaceIds.length - 1
            ];
            _creditWhitelistedSpaceIds.pop();
            break;
          }
        }
        emit CreditWhitelistSpaceRemoved(sid);
      }
    }
  }

  // =========================================================================
  // Internal credit mechanics
  // =========================================================================

  /**
   * @dev If sender cannot cover the transfer from their balance,
   * mint the shortfall as credit (up to their limit).
   */
  function _beforeCreditTransfer(address from, uint256 amount) internal {
    uint256 balance = balanceOf(from);
    if (balance >= amount) {
      return;
    }

    uint256 missing = amount - balance;
    uint256 limit = creditLimitOf(from);
    uint256 used = creditBalanceOf[from];
    require(used + missing <= limit, 'Insufficient credit');

    creditBalanceOf[from] = used + missing;
    _mint(from, missing);

    emit CreditUsed(from, missing, creditBalanceOf[from]);
  }

  /**
   * @dev If the receiver has outstanding credit debt,
   * auto-repay from the incoming transfer by burning tokens.
   */
  function _afterCreditTransfer(address to, uint256 amount) internal {
    uint256 debt = creditBalanceOf[to];
    if (debt == 0) {
      return;
    }

    uint256 repay = debt < amount ? debt : amount;
    creditBalanceOf[to] = debt - repay;
    _burn(to, repay);

    emit CreditRepaid(to, repay, creditBalanceOf[to]);
  }

  function _isInCreditWhitelistedSpace(
    address account
  ) internal view returns (bool) {
    for (uint256 i = 0; i < _creditWhitelistedSpaceIds.length; i++) {
      uint256 sid = _creditWhitelistedSpaceIds[i];
      if (
        isCreditWhitelistedSpace[sid] &&
        IDAOSpaceFactory(spacesContract).isMember(sid, account)
      ) {
        return true;
      }
    }
    return false;
  }
}
