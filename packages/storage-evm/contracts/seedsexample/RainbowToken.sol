// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

/**
 * @title RainbowToken
 * @dev Advanced token contract with backing, demurrage, membership, and credit features
 *
 * Based on the Seeds/Rainbows token design:
 * - Tokens can be backed by other tokens in escrow
 * - Supports demurrage (time-decay) and wealth taxation
 * - Supports membership restrictions on transfers
 * - Supports credit limits (negative balances) and positive limits
 * - Tokens can be created, issued, transferred, and retired with backing redemption
 */
contract RainbowToken is ERC20, Ownable, ReentrancyGuard {
  // ============ Constants ============

  uint8 private constant MAX_BACKINGS = 8;
  uint32 private constant VISITOR = 1;
  uint32 private constant REGULAR = 2;
  uint256 private constant PRECISION = 1e18;

  // ============ Structs ============

  struct TokenConfig {
    address issuer;
    uint256 maxSupply;
    address withdrawalMgr;
    address withdrawTo;
    address freezeMgr;
    uint256 redeemLockedUntil;
    uint256 configLockedUntil;
    bool transfersFrozen;
    bool approved;
    address membershipToken;
    address brokerToken;
    address credLimitToken;
    address posLimitToken;
    address valuationMgr;
    uint256 valPerToken; // Fixed point with 18 decimals
    string refCurrency;
  }

  struct BackingInfo {
    uint64 index;
    uint256 tokenBucket;
    uint256 backsPerBucket;
    address backingTokenContract;
    address escrow;
    uint32 reserveFraction; // Percentage (0-100)
    bool proportional;
  }

  struct Balance {
    int256 amount; // Can be negative for credit
  }

  struct GarnerDate {
    uint256 lastGarner;
  }

  // ============ State Variables ============

  TokenConfig public config;
  string public metadata;

  // Backing relationships
  BackingInfo[] public backings;
  uint64 private nextBackingIndex;

  // Account balances (can be negative)
  mapping(address => int256) private balances;

  // Demurrage tracking
  mapping(address => uint256) public lastGarnerDate;

  // Total supply tracking (separate from ERC20 for credit handling)
  int256 private totalSupplyWithCredit;

  // Events
  event TokenCreated(address indexed issuer, uint256 maxSupply);
  event TokenApproved(bool approved);
  event BackingAdded(
    uint64 indexed backingIndex,
    address indexed backingToken,
    address indexed escrow
  );
  event BackingRemoved(uint64 indexed backingIndex);
  event ValuationSet(uint256 valPerToken, string refCurrency);
  event TokenIssued(address indexed to, uint256 amount);
  event TokenRetired(address indexed from, uint256 amount, bool redeemed);
  event TokensGarnered(
    address indexed from,
    address indexed to,
    uint256 amount
  );
  event TransfersFrozen(bool frozen);

  // ============ Modifiers ============

  modifier onlyIssuer() {
    require(msg.sender == config.issuer, 'Only issuer');
    _;
  }

  modifier onlyWithdrawalMgr() {
    require(msg.sender == config.withdrawalMgr, 'Only withdrawal manager');
    _;
  }

  modifier onlyFreezeMgr() {
    require(msg.sender == config.freezeMgr, 'Only freeze manager');
    _;
  }

  modifier onlyValuationMgr() {
    require(msg.sender == config.valuationMgr, 'Only valuation manager');
    _;
  }

  modifier whenNotFrozen() {
    require(!config.transfersFrozen, 'Transfers are frozen');
    _;
  }

  modifier whenApproved() {
    require(config.approved, 'Token not approved');
    _;
  }

  modifier whenConfigUnlocked() {
    require(block.timestamp >= config.configLockedUntil, 'Config is locked');
    _;
  }

  // ============ Constructor ============

  constructor(
    string memory name,
    string memory symbol,
    address issuer,
    uint256 maxSupply,
    address withdrawalMgr,
    address withdrawTo,
    address freezeMgr,
    uint256 redeemLockedUntil,
    uint256 configLockedUntil
  ) ERC20(name, symbol) Ownable(msg.sender) {
    require(issuer != address(0), 'Invalid issuer');
    require(maxSupply > 0, 'Max supply must be positive');

    config = TokenConfig({
      issuer: issuer,
      maxSupply: maxSupply,
      withdrawalMgr: withdrawalMgr,
      withdrawTo: withdrawTo,
      freezeMgr: freezeMgr,
      redeemLockedUntil: redeemLockedUntil,
      configLockedUntil: configLockedUntil,
      transfersFrozen: false,
      approved: false,
      membershipToken: address(0),
      brokerToken: address(0),
      credLimitToken: address(0),
      posLimitToken: address(0),
      valuationMgr: address(0),
      valPerToken: PRECISION,
      refCurrency: ''
    });

    emit TokenCreated(issuer, maxSupply);
  }

  // ============ Configuration Functions ============

  /**
   * @dev Approve or reject token creation
   */
  function approve(bool approved_) external onlyOwner {
    if (!approved_) {
      require(totalSupply() == 0, 'Cannot reject with outstanding supply');
      // Clear backings
      delete backings;
    }
    config.approved = approved_;
    emit TokenApproved(approved_);
  }

  /**
   * @dev Set valuation information
   */
  function setValuation(
    uint256 valPerToken,
    string calldata refCurrency
  ) external onlyValuationMgr {
    require(valPerToken >= 0, 'Valuation must be non-negative');
    require(bytes(refCurrency).length <= 64, 'Currency string too long');

    config.valPerToken = valPerToken;
    config.refCurrency = refCurrency;

    emit ValuationSet(valPerToken, refCurrency);
  }

  /**
   * @dev Get valuation for a given amount
   */
  function getValuation(
    uint256 amount
  ) external view returns (string memory currency, uint256 valuation) {
    currency = config.refCurrency;
    valuation = (amount * config.valPerToken) / (10 ** decimals());
  }

  /**
   * @dev Set display metadata
   */
  function setMetadata(string calldata jsonMeta) external onlyIssuer {
    require(bytes(jsonMeta).length <= 2048, 'Metadata too long');
    metadata = jsonMeta;
  }

  /**
   * @dev Freeze or unfreeze transfers
   */
  function freeze(bool frozen) external onlyFreezeMgr {
    config.transfersFrozen = frozen;
    emit TransfersFrozen(frozen);
  }

  /**
   * @dev Update configuration (only when unlocked)
   */
  function updateConfig(
    address withdrawalMgr,
    address withdrawTo,
    address freezeMgr,
    uint256 redeemLockedUntil,
    uint256 configLockedUntil,
    address membershipToken,
    address credLimitToken,
    address posLimitToken,
    address valuationMgr
  ) external onlyIssuer whenConfigUnlocked {
    config.withdrawalMgr = withdrawalMgr;
    config.withdrawTo = withdrawTo;
    config.freezeMgr = freezeMgr;
    config.redeemLockedUntil = redeemLockedUntil;
    config.configLockedUntil = configLockedUntil;
    config.membershipToken = membershipToken;
    config.credLimitToken = credLimitToken;
    config.posLimitToken = posLimitToken;
    config.valuationMgr = valuationMgr;
  }

  // ============ Backing Functions ============

  /**
   * @dev Add a backing relationship
   */
  function addBacking(
    uint256 tokenBucket,
    uint256 backsPerBucket,
    address backingTokenContract,
    address escrow,
    bool proportional,
    uint32 reserveFraction
  ) external onlyIssuer whenConfigUnlocked {
    require(backings.length < MAX_BACKINGS, 'Max backings exceeded');
    require(backingTokenContract != address(this), 'Cannot back with self');
    require(backsPerBucket >= 0, 'Backing must be non-negative');
    require(tokenBucket > 0, 'Token bucket must be positive');

    // Verify issuer has backing token balance
    uint256 issuerBalance = IERC20(backingTokenContract).balanceOf(
      config.issuer
    );
    require(issuerBalance > 0, 'Issuer must have backing token');

    BackingInfo memory backing = BackingInfo({
      index: nextBackingIndex++,
      tokenBucket: tokenBucket,
      backsPerBucket: backsPerBucket,
      backingTokenContract: backingTokenContract,
      escrow: escrow,
      reserveFraction: reserveFraction,
      proportional: proportional
    });

    backings.push(backing);

    // If tokens already issued, back them
    if (totalSupply() > 0) {
      _setBacking(backing, config.issuer, totalSupply());
    }

    emit BackingAdded(backing.index, backingTokenContract, escrow);
  }

  /**
   * @dev Remove a backing relationship
   */
  function removeBacking(
    uint64 backingIndex
  ) external onlyIssuer whenConfigUnlocked {
    uint256 idx = _findBackingIndex(backingIndex);
    require(idx < backings.length, 'Backing not found');

    BackingInfo memory backing = backings[idx];

    // Redeem backing if tokens exist
    if (totalSupply() > 0) {
      _redeemBacking(backing, config.issuer, totalSupply());
    }

    // Remove from array
    backings[idx] = backings[backings.length - 1];
    backings.pop();

    emit BackingRemoved(backingIndex);
  }

  /**
   * @dev Get all backings
   */
  function getBackings() external view returns (BackingInfo[] memory) {
    return backings;
  }

  // ============ Token Functions ============

  /**
   * @dev Issue new tokens
   */
  function issue(uint256 amount) external onlyIssuer whenApproved {
    require(amount > 0, 'Must issue positive amount');
    require(totalSupply() + amount <= config.maxSupply, 'Exceeds max supply');

    // Set backings for issued tokens
    for (uint i = 0; i < backings.length; i++) {
      _setBacking(backings[i], config.issuer, amount);
    }

    _mint(config.issuer, amount);
    _addBalance(config.issuer, int256(amount));

    emit TokenIssued(config.issuer, amount);
  }

  /**
   * @dev Retire tokens with optional redemption
   */
  function retire(uint256 amount, bool doRedeem) external nonReentrant {
    require(amount > 0, 'Must retire positive amount');
    require(balanceOf(msg.sender) >= amount, 'Insufficient balance');

    if (doRedeem) {
      if (block.timestamp >= config.redeemLockedUntil) {
        require(!config.transfersFrozen, 'Transfers are frozen');
      } else {
        require(msg.sender == config.issuer, 'Bearer redeem is disabled');
      }

      // Redeem all backings
      for (uint i = 0; i < backings.length; i++) {
        _redeemBacking(backings[i], msg.sender, amount);
      }
    }

    _subBalance(msg.sender, int256(amount));
    _burn(msg.sender, amount);

    emit TokenRetired(msg.sender, amount, doRedeem);
  }

  // ============ Transfer Functions ============

  /**
   * @dev Override transfer to support credit and membership checks
   */
  function transfer(
    address to,
    uint256 amount
  ) public virtual override whenApproved nonReentrant returns (bool) {
    return _transferWithChecks(msg.sender, to, amount);
  }

  /**
   * @dev Override transferFrom to support credit and membership checks
   */
  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public virtual override whenApproved nonReentrant returns (bool) {
    _spendAllowance(from, msg.sender, amount);
    return _transferWithChecks(from, to, amount);
  }

  /**
   * @dev Internal transfer with credit and membership checks
   */
  function _transferWithChecks(
    address from,
    address to,
    uint256 amount
  ) internal returns (bool) {
    require(from != to, 'Cannot transfer to self');
    require(to != address(0), 'Invalid recipient');

    // Check if this is a withdrawal operation
    bool isWithdrawal = (msg.sender == config.withdrawalMgr &&
      to == config.withdrawTo);

    if (!isWithdrawal) {
      // Normal transfer checks
      if (from != config.issuer) {
        require(!config.transfersFrozen, 'Transfers are frozen');
      }

      // Membership checks
      if (config.membershipToken != address(0)) {
        _checkMembership(from, to);
      }
    }

    // Handle credit limits
    _subBalance(from, int256(amount));
    _addBalance(to, int256(amount));

    // Standard ERC20 transfer
    _transfer(from, to, amount);

    return true;
  }

  /**
   * @dev Garner (demurrage/wealth tax) function
   */
  function garner(
    address from,
    uint256 ppmPerWeek,
    uint256 ppmAbs
  ) external onlyWithdrawalMgr nonReentrant {
    require(ppmPerWeek >= 0, 'ppmPerWeek must be non-negative');
    require(ppmAbs >= 0, 'ppmAbs must be non-negative');

    int256 fromBalance = balances[from];
    if (fromBalance <= 0) {
      return; // No positive balance to garner
    }

    uint256 demurragePpm = 0;

    // Calculate time-based demurrage
    if (ppmPerWeek > 0) {
      if (lastGarnerDate[from] == 0) {
        // First garner - just set date
        lastGarnerDate[from] = block.timestamp;
        return;
      } else {
        uint256 elapsedSec = block.timestamp - lastGarnerDate[from];
        lastGarnerDate[from] = block.timestamp;

        uint256 secsPerWeek = 7 * 24 * 60 * 60;
        demurragePpm = (elapsedSec * ppmPerWeek) / secsPerWeek;
      }
    }

    // Calculate total garner amount
    uint256 totalPpm = demurragePpm + ppmAbs;
    uint256 amount = (uint256(fromBalance) * totalPpm) / 1_000_000;

    if (amount > 0) {
      _transferWithChecks(from, config.withdrawTo, amount);
      emit TokensGarnered(from, config.withdrawTo, amount);
    }
  }

  // ============ Balance Management ============

  /**
   * @dev Get balance (can be negative for credit)
   */
  function balanceWithCredit(address account) external view returns (int256) {
    return balances[account];
  }

  /**
   * @dev Override balanceOf to return 0 for negative balances
   */
  function balanceOf(
    address account
  ) public view virtual override returns (uint256) {
    int256 bal = balances[account];
    return bal > 0 ? uint256(bal) : 0;
  }

  /**
   * @dev Subtract balance with credit limit check
   */
  function _subBalance(address owner, int256 value) internal {
    int256 credLimit = 0;

    // Get credit limit from limit token
    if (config.credLimitToken != address(0)) {
      credLimit = int256(IERC20(config.credLimitToken).balanceOf(owner));
    }

    int256 oldAmount = balances[owner];
    int256 newAmount = oldAmount - value;

    require(newAmount + credLimit >= 0, 'Overdrawn balance');

    balances[owner] = newAmount;

    // Update supply if credit increased
    int256 creditIncrease = _min(oldAmount, 0) - _min(newAmount, 0);
    totalSupplyWithCredit += creditIncrease;
  }

  /**
   * @dev Add balance with positive limit check
   */
  function _addBalance(address owner, int256 value) internal {
    int256 posLimit = type(int256).max;

    // Get positive limit from limit token
    if (config.posLimitToken != address(0)) {
      posLimit = int256(IERC20(config.posLimitToken).balanceOf(owner));
    }

    int256 oldAmount = balances[owner];
    int256 newAmount = oldAmount + value;

    require(newAmount <= posLimit, 'Exceeds positive limit');

    balances[owner] = newAmount;

    // Update supply if credit decreased
    int256 creditIncrease = _min(oldAmount, 0) - _min(newAmount, 0);
    totalSupplyWithCredit += creditIncrease;
  }

  // ============ Internal Helpers ============

  /**
   * @dev Set backing for issued tokens
   */
  function _setBacking(
    BackingInfo memory backing,
    address owner,
    uint256 quantity
  ) internal {
    if (backing.backsPerBucket > 0) {
      uint256 backingQuantity = (quantity * backing.backsPerBucket) /
        backing.tokenBucket;

      require(
        IERC20(backing.backingTokenContract).transferFrom(
          owner,
          backing.escrow,
          backingQuantity
        ),
        'Backing transfer failed'
      );
    }
  }

  /**
   * @dev Redeem backing for retired tokens
   */
  function _redeemBacking(
    BackingInfo memory backing,
    address owner,
    uint256 quantity
  ) internal {
    uint256 backingInEscrow = IERC20(backing.backingTokenContract).balanceOf(
      backing.escrow
    );
    uint256 supply = totalSupply();
    require(supply > 0, 'No supply to redeem');

    uint256 backingQuantity;

    if (backing.proportional) {
      // Proportional redemption
      backingQuantity = (backingInEscrow * quantity) / supply;
    } else {
      // Fixed ratio redemption
      backingQuantity =
        (quantity * backing.backsPerBucket) /
        backing.tokenBucket;

      // Check reserve fraction
      uint256 backingRemaining = backingInEscrow - backingQuantity;
      uint256 supplyRemaining = supply - quantity;
      uint256 escrowNeeded = (supplyRemaining *
        backing.reserveFraction *
        backing.backsPerBucket) / (100 * backing.tokenBucket);

      require(backingRemaining >= escrowNeeded, 'Escrow underfunded');
    }

    if (backingQuantity > 0) {
      // Note: This requires escrow to approve this contract or use a transfer pattern
      require(
        IERC20(backing.backingTokenContract).transferFrom(
          backing.escrow,
          owner,
          backingQuantity
        ),
        'Backing redemption failed'
      );
    }
  }

  /**
   * @dev Check membership requirements
   */
  function _checkMembership(address from, address to) internal view {
    uint256 fromMembership = IERC20(config.membershipToken).balanceOf(from);
    uint256 toMembership = IERC20(config.membershipToken).balanceOf(to);

    require(fromMembership > 0, 'From must have membership');
    require(toMembership > 0, 'To must have membership');

    bool visToVis = (toMembership == VISITOR && fromMembership == VISITOR);
    require(!visToVis, 'Cannot transfer visitor to visitor');
  }

  function _findBackingIndex(
    uint64 backingIndex
  ) internal view returns (uint256) {
    for (uint i = 0; i < backings.length; i++) {
      if (backings[i].index == backingIndex) {
        return i;
      }
    }
    return type(uint256).max;
  }

  function _min(int256 a, int256 b) internal pure returns (int256) {
    return a < b ? a : b;
  }

  // ============ Emergency ============

  function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
    require(IERC20(token).transfer(owner(), amount), 'Transfer failed');
  }
}
