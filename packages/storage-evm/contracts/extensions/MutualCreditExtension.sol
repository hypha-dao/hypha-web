// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '../interfaces/ITokenExtension.sol';
import '../interfaces/IDAOSpaceFactory.sol';

/**
 * @title MutualCreditExtension
 * @dev Mutual credit system. Members can spend beyond their balance up to a
 *      credit limit. Tokens are minted on deficit and burned on repayment.
 *      Deployed as a clone (EIP-1167) per token.
 */
contract MutualCreditExtension is Initializable, ITokenExtension {
  address public token;

  uint256 public defaultCreditLimit;
  mapping(address => uint256) public creditBalanceOf;
  mapping(address => uint256) public customCreditLimit;
  mapping(address => bool) public hasCustomCreditLimit;
  uint256[] internal _creditWhitelistedSpaceIds;
  mapping(uint256 => bool) public isCreditWhitelistedSpace;

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

  function initialize(
    uint256 _defaultCreditLimit,
    uint256[] memory _initialCreditWhitelistSpaceIds
  ) external initializer {
    defaultCreditLimit = _defaultCreditLimit;
    for (uint256 i = 0; i < _initialCreditWhitelistSpaceIds.length; i++) {
      uint256 sid = _initialCreditWhitelistSpaceIds[i];
      if (!isCreditWhitelistedSpace[sid]) {
        isCreditWhitelistedSpace[sid] = true;
        _creditWhitelistedSpaceIds.push(sid);
      }
    }
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
  // ITokenExtension hooks
  // =========================================================================

  function beforeTransfer(
    address from,
    address /* to */,
    uint256 amount
  ) external override onlyToken {
    ISpaceTokenBase _token = ISpaceTokenBase(token);
    uint256 bal = _token.balanceOf(from);
    if (bal >= amount) return;

    uint256 missing = amount - bal;
    uint256 limit = creditLimitOf(from);
    uint256 used = creditBalanceOf[from];
    require(used + missing <= limit, 'Insufficient credit');

    creditBalanceOf[from] = used + missing;
    _token.extensionMint(from, missing);
    emit CreditUsed(from, missing, creditBalanceOf[from]);
  }

  function afterTransfer(
    address /* from */,
    address to,
    uint256 amount
  ) external override onlyToken {
    uint256 debt = creditBalanceOf[to];
    if (debt == 0) return;

    uint256 repay = debt < amount ? debt : amount;
    creditBalanceOf[to] = debt - repay;
    ISpaceTokenBase(token).extensionBurn(to, repay);
    emit CreditRepaid(to, repay, creditBalanceOf[to]);
  }

  function beforeMint(
    address /* to */,
    uint256 /* amount */
  ) external override onlyToken {
    // No action needed on mint
  }

  // =========================================================================
  // Credit view functions
  // =========================================================================

  function creditLimitOf(address account) public view returns (uint256) {
    if (hasCustomCreditLimit[account]) return customCreditLimit[account];
    if (_isInCreditWhitelistedSpace(account)) return defaultCreditLimit;
    return 0;
  }

  function creditLimitLeftOf(address account) public view returns (uint256) {
    uint256 limit = creditLimitOf(account);
    uint256 used = creditBalanceOf[account];
    return used >= limit ? 0 : limit - used;
  }

  function netBalanceOf(address account) public view returns (int256) {
    return
      int256(ISpaceTokenBase(token).balanceOf(account)) -
      int256(creditBalanceOf[account]);
  }

  function getCreditWhitelistedSpaces()
    external
    view
    returns (uint256[] memory)
  {
    return _creditWhitelistedSpaceIds;
  }

  // =========================================================================
  // Credit admin (executor only)
  // =========================================================================

  function setDefaultCreditLimit(uint256 _limit) external onlyExecutor {
    uint256 old = defaultCreditLimit;
    defaultCreditLimit = _limit;
    emit DefaultCreditLimitUpdated(old, _limit);
  }

  function setCreditLimit(
    address member,
    uint256 limit
  ) external onlyExecutor {
    customCreditLimit[member] = limit;
    hasCustomCreditLimit[member] = true;
    emit CreditLimitSet(member, limit);
  }

  function removeCreditLimit(address member) external onlyExecutor {
    delete customCreditLimit[member];
    hasCustomCreditLimit[member] = false;
    emit CreditLimitRemoved(member);
  }

  function forgiveCredit(
    address member,
    uint256 amount
  ) external onlyExecutor {
    uint256 debt = creditBalanceOf[member];
    require(amount <= debt, 'Amount exceeds credit balance');
    creditBalanceOf[member] = debt - amount;
    emit CreditForgiven(member, amount, creditBalanceOf[member]);
  }

  function batchAddCreditWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external onlyExecutor {
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
  ) external onlyExecutor {
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
  // Internal
  // =========================================================================

  function _isInCreditWhitelistedSpace(
    address account
  ) internal view returns (bool) {
    ISpaceTokenBase _token = ISpaceTokenBase(token);
    address spaces = _token.spacesContract();
    for (uint256 i = 0; i < _creditWhitelistedSpaceIds.length; i++) {
      uint256 sid = _creditWhitelistedSpaceIds[i];
      if (
        isCreditWhitelistedSpace[sid] &&
        IDAOSpaceFactory(spaces).isMember(sid, account)
      ) {
        return true;
      }
    }
    return false;
  }
}
