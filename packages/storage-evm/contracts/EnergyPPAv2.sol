// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './EnergyToken.sol';

/// @title  EnergyPPAv2
/// @notice On-chain per-source energy settlement for a community.
///
///         Each energy source (solar park, battery, etc.) has its own ERC-20
///         ownership token (e.g. RegularSpaceToken proxy). Revenue from each
///         source is split on-chain to that source's token holders —
///         proportional to their token balance.
///
///         consumeEnergy() does everything in two phases:
///
///         Phase 1 — Charge consumers:
///           Each reading debits the consumer at the reading's price.
///           Revenue accumulates per source. Import charges go to gridBalance.
///           Export readings (from the designated export device) generate
///           revenue for the source and credit gridBalance.
///
///         Phase 2 — Split revenue per source:
///           For each source: community fee → aggregator fee → remainder to
///           that source's ownership-token holders by balance proportion.
///
///         gridBalance tracks the community's net position with the grid:
///           negative → community imported more than exported (owes the grid)
///           positive → community exported more than imported (grid owes community)
///
///         The source registry stores a basePricePerKwh for each source as a
///         transparent reference (the agreed PPA price). The backend reads it,
///         may adjust it (time-of-use, spot market, etc.), and passes the
///         final price in each ConsumptionReading. The contract does not
///         enforce the base price — the backend is the pricing authority.
contract EnergyPPAv2 is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  ReentrancyGuardUpgradeable
{
  // ════════════════════════════════════════════════════════════════════════
  //  Constants
  // ════════════════════════════════════════════════════════════════════════

  bytes32 public constant IMPORT_SOURCE_ID = keccak256('IMPORT');

  // ════════════════════════════════════════════════════════════════════════
  //  Types
  // ════════════════════════════════════════════════════════════════════════

  enum SourceType {
    SOLAR,
    BATTERY
  }

  struct EnergySource {
    SourceType sourceType;
    address ownershipToken; // ERC-20 ownership token (e.g. RegularSpaceToken)
    uint256 basePricePerKwh; // agreed PPA base price (reference, not enforced)
    bool active;
  }

  struct ConsumptionReading {
    uint256 deviceId;
    uint256 quantity;      // energy in contract-internal units
    uint256 pricePerKwh;   // final price determined by backend
    bytes32 sourceId;      // registered source ID, or IMPORT_SOURCE_ID for grid
  }

  struct Member {
    address memberAddress;
    uint256[] deviceIds; // empty for pure investors
    bool isActive;
    bytes32 metadataHash;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Storage
  // ════════════════════════════════════════════════════════════════════════

  // ── Source Registry ──────────────────────────────────────────────────
  mapping(bytes32 => EnergySource) internal sources;
  bytes32[] internal sourceIds;

  // ── Members ──────────────────────────────────────────────────────────
  mapping(address => Member) internal members;
  address[] internal memberAddresses;
  mapping(uint256 => address) internal deviceToMember;

  // ── Balances ─────────────────────────────────────────────────────────
  EnergyToken internal energyToken;
  mapping(address => int256) internal energyCreditBalances;

  /// @notice Net grid position for the community.
  ///         negative = community imported more (owes grid)
  ///         positive = community exported more (grid owes community)
  int256 internal gridBalance;

  int256 internal settledBalance;

  // ── Fee Config ───────────────────────────────────────────────────────
  address internal communityAddress;
  address internal aggregatorAddress;
  uint16 internal communityFeeBps;
  uint16 internal aggregatorFeeBps;

  // ── Export ───────────────────────────────────────────────────────────
  uint256 internal exportDeviceId;

  // ── Settlement ───────────────────────────────────────────────────────
  address internal stablecoinAddress;
  address internal paymentRecipient;

  // ── Access ───────────────────────────────────────────────────────────
  mapping(address => bool) internal isWhitelisted;

  // ── Grid settlement ────────────────────────────────────────────
  address internal gridOperatorAddress;

  uint256[30] private __gap;

  // ════════════════════════════════════════════════════════════════════════
  //  Events
  // ════════════════════════════════════════════════════════════════════════

  event SourceRegistered(
    bytes32 indexed sourceId,
    SourceType sourceType,
    address ownershipToken,
    uint256 pricePerKwh
  );
  event SourcePriceUpdated(bytes32 indexed sourceId, uint256 oldPrice, uint256 newPrice);
  event SourceDeactivated(bytes32 indexed sourceId);

  event EnergyConsumed(
    address indexed consumer,
    uint256 quantity,
    uint256 pricePerKwh,
    bytes32 indexed sourceId
  );
  event EnergyExported(uint256 quantity, uint256 revenue, bytes32 indexed sourceId);
  event RevenueDistributed(
    address indexed owner,
    uint256 amount,
    bytes32 indexed sourceId,
    uint256 totalSourceRevenue
  );
  event CommunityFeeCollected(address indexed community, uint256 amount, bytes32 indexed sourceId);
  event AggregatorFeeCollected(address indexed aggregator, uint256 amount, bytes32 indexed sourceId);

  event MemberAdded(address indexed member);
  event MemberRemoved(address indexed member);
  event DebtSettled(
    address indexed payer,
    address indexed debtor,
    uint256 stablecoinAmount,
    int256 previousBalance,
    int256 newBalance
  );
  event CreditClaimed(
    address indexed claimant,
    uint256 stablecoinAmount,
    int256 previousBalance,
    int256 newBalance
  );
  event WhitelistUpdated(address indexed account, bool isWhitelisted);
  event ExportDeviceIdSet(uint256 deviceId);
  event EmergencyReset();
  event GridOperatorSet(address indexed operator);
  event GridDebtSettled(address indexed payer, uint256 stablecoinAmount, int256 previousGrid, int256 newGrid);
  event GridCreditClaimed(address indexed beneficiary, uint256 stablecoinAmount, int256 previousGrid, int256 newGrid);

  // ════════════════════════════════════════════════════════════════════════
  //  Init
  // ════════════════════════════════════════════════════════════════════════

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address initialOwner,
    address _energyToken,
    address _stablecoin,
    address _paymentRecipient,
    address _gridOperator
  ) public initializer {
    __Ownable_init(initialOwner);
    __UUPSUpgradeable_init();
    __ReentrancyGuard_init();

    energyToken = EnergyToken(_energyToken);
    stablecoinAddress = _stablecoin;
    paymentRecipient = _paymentRecipient;
    gridOperatorAddress = _gridOperator;
  }

  function _authorizeUpgrade(address) internal override onlyOwner {}

  modifier onlyWhitelist() {
    require(isWhitelisted[msg.sender], 'Not whitelisted');
    _;
  }

  modifier ensureZeroSum() {
    _;
    (bool ok, ) = _verifyZeroSum();
    require(ok, 'Zero-sum violation');
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Source Registry
  // ════════════════════════════════════════════════════════════════════════

  function registerSource(
    bytes32 sourceId,
    SourceType sourceType,
    address ownershipToken,
    uint256 basePricePerKwh
  ) external onlyWhitelist {
    require(sources[sourceId].ownershipToken == address(0), 'Source exists');
    require(ownershipToken != address(0), 'Invalid token');

    sources[sourceId] = EnergySource({
      sourceType: sourceType,
      ownershipToken: ownershipToken,
      basePricePerKwh: basePricePerKwh,
      active: true
    });
    sourceIds.push(sourceId);

    emit SourceRegistered(sourceId, sourceType, ownershipToken, basePricePerKwh);
  }

  function updateSourceBasePrice(
    bytes32 sourceId,
    uint256 newBasePrice
  ) external onlyWhitelist {
    require(sources[sourceId].active, 'Source not active');
    uint256 old = sources[sourceId].basePricePerKwh;
    sources[sourceId].basePricePerKwh = newBasePrice;
    emit SourcePriceUpdated(sourceId, old, newBasePrice);
  }

  function deactivateSource(bytes32 sourceId) external onlyWhitelist {
    require(sources[sourceId].active, 'Source not active');
    sources[sourceId].active = false;
    emit SourceDeactivated(sourceId);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Core: consumeEnergy
  // ════════════════════════════════════════════════════════════════════════

  /// @notice Process an interval's consumption readings and distribute revenue.
  ///
  ///         The backend sends one reading per (member, source) pair.
  ///         Each reading carries its own pricePerKwh — determined by the
  ///         backend from on-chain base price, external APIs, time-of-use
  ///         adjustments, etc. The contract does not enforce the base price.
  ///
  /// @param readings  Flat array of consumption entries with prices.
  function consumeEnergy(
    ConsumptionReading[] calldata readings
  ) external onlyWhitelist ensureZeroSum {
    require(readings.length > 0, 'No readings');

    uint256 numSources = sourceIds.length;
    uint256[] memory srcRevenues = new uint256[](numSources);

    // ── Phase 1: Process each reading — charge consumers ──────────────
    for (uint256 i = 0; i < readings.length; i++) {
      ConsumptionReading calldata r = readings[i];
      require(r.pricePerKwh > 0, 'Price must be > 0');

      // ── Export ──
      if (r.deviceId == exportDeviceId) {
        require(r.sourceId != IMPORT_SOURCE_ID, 'Cannot export import');
        uint256 revenue = r.quantity * r.pricePerKwh;
        _addSourceRevenue(srcRevenues, r.sourceId, revenue);
        gridBalance += int256(revenue);
        emit EnergyExported(r.quantity, revenue, r.sourceId);
        continue;
      }

      address consumer = deviceToMember[r.deviceId];
      require(consumer != address(0), 'Device not found');
      require(members[consumer].isActive, 'Member not active');

      uint256 charge = r.quantity * r.pricePerKwh;
      _adjustEnergyCreditBalance(consumer, -int256(charge));

      // ── Grid import ──
      if (r.sourceId == IMPORT_SOURCE_ID) {
        gridBalance -= int256(charge);
      }
      // ── Local source (solar, battery, etc.) ──
      else {
        require(sources[r.sourceId].active, 'Source not active');
        _addSourceRevenue(srcRevenues, r.sourceId, charge);
      }

      emit EnergyConsumed(consumer, r.quantity, r.pricePerKwh, r.sourceId);
    }

    // ── Phase 2: Distribute revenue per source to token holders ───────
    for (uint256 i = 0; i < numSources; i++) {
      if (srcRevenues[i] > 0) {
        _distributeSourceRevenue(sourceIds[i], srcRevenues[i]);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Revenue Distribution (per source)
  // ════════════════════════════════════════════════════════════════════════

  /// @dev Accumulate revenue into the memory array for a given source.
  function _addSourceRevenue(
    uint256[] memory revenues,
    bytes32 sourceId,
    uint256 amount
  ) internal view {
    for (uint256 i = 0; i < sourceIds.length; i++) {
      if (sourceIds[i] == sourceId) {
        revenues[i] += amount;
        return;
      }
    }
    revert('Unknown source');
  }

  /// @dev Split one source's revenue: fees first, then pro-rata to token holders.
  ///      Last holder receives the remainder to absorb rounding dust.
  function _distributeSourceRevenue(
    bytes32 sourceId,
    uint256 totalRevenue
  ) internal {
    uint256 remaining = totalRevenue;

    // Community fee
    if (communityFeeBps > 0 && communityAddress != address(0)) {
      uint256 fee = (totalRevenue * communityFeeBps) / 10000;
      _adjustEnergyCreditBalance(communityAddress, int256(fee));
      remaining -= fee;
      emit CommunityFeeCollected(communityAddress, fee, sourceId);
    }

    // Aggregator fee
    if (aggregatorFeeBps > 0 && aggregatorAddress != address(0)) {
      uint256 fee = (totalRevenue * aggregatorFeeBps) / 10000;
      _adjustEnergyCreditBalance(aggregatorAddress, int256(fee));
      remaining -= fee;
      emit AggregatorFeeCollected(aggregatorAddress, fee, sourceId);
    }

    if (remaining == 0) return;

    address tokenAddr = sources[sourceId].ownershipToken;
    IERC20 token = IERC20(tokenAddr);
    uint256 totalSupply = token.totalSupply();
    if (totalSupply == 0) return;

    address lastHolder = address(0);
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      if (token.balanceOf(memberAddresses[i]) > 0) {
        lastHolder = memberAddresses[i];
      }
    }
    if (lastHolder == address(0)) return;

    uint256 distributed = 0;
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      address addr = memberAddresses[i];
      uint256 tokenBal = token.balanceOf(addr);
      if (tokenBal == 0) continue;

      uint256 share;
      if (addr == lastHolder) {
        share = remaining - distributed;
      } else {
        share = (remaining * tokenBal) / totalSupply;
      }
      distributed += share;

      if (share > 0) {
        _adjustEnergyCreditBalance(addr, int256(share));
        emit RevenueDistributed(addr, share, sourceId, totalRevenue);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Members
  // ════════════════════════════════════════════════════════════════════════

  function addMember(
    address memberAddress,
    uint256[] calldata deviceIds,
    bytes32 metadataHash
  ) external onlyWhitelist {
    require(memberAddress != address(0), 'Invalid address');
    require(!members[memberAddress].isActive, 'Member exists');

    for (uint256 i = 0; i < deviceIds.length; i++) {
      require(
        deviceToMember[deviceIds[i]] == address(0),
        'Device already assigned'
      );
    }

    members[memberAddress] = Member({
      memberAddress: memberAddress,
      deviceIds: deviceIds,
      isActive: true,
      metadataHash: metadataHash
    });
    memberAddresses.push(memberAddress);

    for (uint256 i = 0; i < deviceIds.length; i++) {
      deviceToMember[deviceIds[i]] = memberAddress;
    }

    emit MemberAdded(memberAddress);
  }

  function removeMember(address memberAddress) external onlyWhitelist {
    require(members[memberAddress].isActive, 'Member does not exist');
    Member memory m = members[memberAddress];

    for (uint256 i = 0; i < m.deviceIds.length; i++) {
      delete deviceToMember[m.deviceIds[i]];
    }

    for (uint256 i = 0; i < memberAddresses.length; i++) {
      if (memberAddresses[i] == memberAddress) {
        memberAddresses[i] = memberAddresses[memberAddresses.length - 1];
        memberAddresses.pop();
        break;
      }
    }

    delete members[memberAddress];
    delete energyCreditBalances[memberAddress];

    uint256 tokenBal = energyToken.balanceOf(memberAddress);
    if (tokenBal > 0) energyToken.burn(memberAddress, tokenBal);

    emit MemberRemoved(memberAddress);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Stablecoin Settlement
  // ════════════════════════════════════════════════════════════════════════

  function settleDebt(
    address debtor,
    uint256 stablecoinAmount
  ) external nonReentrant {
    _settle(debtor, stablecoinAmount);
  }

  function settleOwnDebt(uint256 stablecoinAmount) external nonReentrant {
    _settle(msg.sender, stablecoinAmount);
  }

  function _settle(address debtor, uint256 stablecoinAmount) internal {
    require(debtor != address(0), 'Invalid debtor');
    require(stablecoinAmount > 0, 'Amount must be > 0');
    require(stablecoinAddress != address(0), 'No stablecoin configured');

    int256 balance = _getEnergyCreditBalance(debtor);
    require(balance < 0, 'No debt');

    uint256 internalAmount = stablecoinAmount / 10000;
    require(internalAmount > 0, 'Amount too small');

    uint256 debt = uint256(-balance);
    uint256 settle = internalAmount > debt ? debt : internalAmount;
    uint256 requiredStablecoin = settle * 10000;

    IERC20 coin = IERC20(stablecoinAddress);
    require(
      coin.transferFrom(msg.sender, address(this), requiredStablecoin),
      'Stablecoin transfer failed'
    );

    int256 prev = balance;
    int256 newBal = balance + int256(settle);
    if (newBal > 0) newBal = 0;

    _setEnergyCreditBalance(debtor, newBal);
    settledBalance -= int256(settle);

    emit DebtSettled(msg.sender, debtor, requiredStablecoin, prev, newBal);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Credit Claiming
  // ════════════════════════════════════════════════════════════════════════

  function claimCredit(uint256 internalAmount) external nonReentrant {
    _claim(msg.sender, internalAmount);
  }

  function claimCreditFor(
    address beneficiary,
    uint256 internalAmount
  ) external onlyWhitelist nonReentrant {
    _claim(beneficiary, internalAmount);
  }

  function _claim(address beneficiary, uint256 internalAmount) internal {
    require(beneficiary != address(0), 'Invalid address');
    require(internalAmount > 0, 'Amount must be > 0');
    require(stablecoinAddress != address(0), 'No stablecoin configured');

    int256 balance = _getEnergyCreditBalance(beneficiary);
    require(balance > 0, 'No credit');

    uint256 available = uint256(balance);
    uint256 claim = internalAmount > available ? available : internalAmount;
    uint256 stablecoinAmount = claim * 10000;

    IERC20 coin = IERC20(stablecoinAddress);
    require(
      coin.balanceOf(address(this)) >= stablecoinAmount,
      'Insufficient contract liquidity'
    );

    int256 prev = balance;
    int256 newBal = balance - int256(claim);
    _setEnergyCreditBalance(beneficiary, newBal);
    settledBalance += int256(claim);

    require(
      coin.transfer(beneficiary, stablecoinAmount),
      'Stablecoin transfer failed'
    );

    emit CreditClaimed(beneficiary, stablecoinAmount, prev, newBal);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Grid Settlement
  // ════════════════════════════════════════════════════════════════════════

  /// @notice Settle a negative grid balance (community imported more than exported).
  ///         Anyone can pay; stablecoins flow into the contract and gridBalance
  ///         moves toward zero.  settledBalance adjusts to maintain zero-sum.
  function settleGridDebt(uint256 stablecoinAmount) external nonReentrant {
    require(stablecoinAmount > 0, 'Amount must be > 0');
    require(stablecoinAddress != address(0), 'No stablecoin configured');
    require(gridBalance < 0, 'No grid debt');

    uint256 internalAmount = stablecoinAmount / 10000;
    require(internalAmount > 0, 'Amount too small');

    uint256 debt = uint256(-gridBalance);
    uint256 settle = internalAmount > debt ? debt : internalAmount;
    uint256 requiredStablecoin = settle * 10000;

    IERC20 coin = IERC20(stablecoinAddress);
    require(
      coin.transferFrom(msg.sender, address(this), requiredStablecoin),
      'Stablecoin transfer failed'
    );

    int256 prev = gridBalance;
    gridBalance += int256(settle);
    settledBalance -= int256(settle);

    emit GridDebtSettled(msg.sender, requiredStablecoin, prev, gridBalance);
  }

  /// @notice Claim a positive grid balance (community exported more than imported).
  ///         Only the grid operator or a whitelisted admin can claim.
  ///         Stablecoins flow out of the contract to the beneficiary.
  function claimGridCredit(
    address beneficiary,
    uint256 internalAmount
  ) external nonReentrant {
    require(
      msg.sender == gridOperatorAddress || isWhitelisted[msg.sender],
      'Not grid operator or whitelisted'
    );
    require(beneficiary != address(0), 'Invalid address');
    require(internalAmount > 0, 'Amount must be > 0');
    require(stablecoinAddress != address(0), 'No stablecoin configured');
    require(gridBalance > 0, 'No grid credit');

    uint256 available = uint256(gridBalance);
    uint256 claim = internalAmount > available ? available : internalAmount;
    uint256 stablecoinAmount = claim * 10000;

    IERC20 coin = IERC20(stablecoinAddress);
    require(
      coin.balanceOf(address(this)) >= stablecoinAmount,
      'Insufficient contract liquidity'
    );

    int256 prev = gridBalance;
    gridBalance -= int256(claim);
    settledBalance += int256(claim);

    require(
      coin.transfer(beneficiary, stablecoinAmount),
      'Stablecoin transfer failed'
    );

    emit GridCreditClaimed(beneficiary, stablecoinAmount, prev, gridBalance);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Admin
  // ════════════════════════════════════════════════════════════════════════

  function updateWhitelist(
    address account,
    bool _isWhitelisted
  ) external onlyOwner {
    require(account != address(0), 'Invalid address');
    isWhitelisted[account] = _isWhitelisted;
    emit WhitelistUpdated(account, _isWhitelisted);
  }

  function setEnergyToken(address tokenAddress) external onlyWhitelist {
    require(tokenAddress != address(0), 'Invalid address');
    energyToken = EnergyToken(tokenAddress);
  }

  function setStablecoin(address tokenAddress) external onlyWhitelist {
    stablecoinAddress = tokenAddress;
  }

  function setExportDeviceId(uint256 deviceId) external onlyWhitelist {
    exportDeviceId = deviceId;
    emit ExportDeviceIdSet(deviceId);
  }

  function setCommunityAddress(address addr) external onlyOwner {
    communityAddress = addr;
  }

  function setAggregatorAddress(address addr) external onlyOwner {
    aggregatorAddress = addr;
  }

  function setCommunityFeeBps(uint16 bps) external onlyOwner {
    require(bps + aggregatorFeeBps <= 10000, 'Total fees exceed 100%');
    communityFeeBps = bps;
  }

  function setAggregatorFeeBps(uint16 bps) external onlyOwner {
    require(communityFeeBps + bps <= 10000, 'Total fees exceed 100%');
    aggregatorFeeBps = bps;
  }

  function setPaymentRecipient(address recipient) external onlyOwner {
    paymentRecipient = recipient;
  }

  function setGridOperator(address operator) external onlyOwner {
    gridOperatorAddress = operator;
    emit GridOperatorSet(operator);
  }

  function emergencyReset() external onlyWhitelist {
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      _setEnergyCreditBalance(memberAddresses[i], 0);
    }
    if (communityAddress != address(0)) {
      _setEnergyCreditBalance(communityAddress, 0);
    }
    if (aggregatorAddress != address(0)) {
      _setEnergyCreditBalance(aggregatorAddress, 0);
    }
    gridBalance = 0;
    settledBalance = 0;
    emit EmergencyReset();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Internal: balance management
  // ════════════════════════════════════════════════════════════════════════

  function _getEnergyCreditBalance(
    address account
  ) internal view returns (int256) {
    uint256 tokenBal = energyToken.balanceOf(account);
    return tokenBal > 0 ? int256(tokenBal) : energyCreditBalances[account];
  }

  function _setEnergyCreditBalance(address account, int256 amount) internal {
    uint256 current = energyToken.balanceOf(account);
    if (current > 0) energyToken.burn(account, current);
    energyCreditBalances[account] = 0;

    if (amount > 0) {
      energyToken.transfer(account, uint256(amount));
    } else if (amount < 0) {
      energyCreditBalances[account] = amount;
    }
  }

  function _adjustEnergyCreditBalance(
    address account,
    int256 adjustment
  ) internal {
    _setEnergyCreditBalance(
      account,
      _getEnergyCreditBalance(account) + adjustment
    );
  }

  function _verifyZeroSum() internal view returns (bool, int256) {
    int256 total = 0;
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      total += _getEnergyCreditBalance(memberAddresses[i]);
    }
    if (communityAddress != address(0)) {
      total += _getEnergyCreditBalance(communityAddress);
    }
    if (aggregatorAddress != address(0)) {
      total += _getEnergyCreditBalance(aggregatorAddress);
    }
    // gridBalance is negative for imports (member balances went down,
    // so -gridBalance compensates), positive for exports (source owners
    // went up, so -gridBalance compensates).
    total += -gridBalance + settledBalance;
    return (total == 0, total);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Views
  // ════════════════════════════════════════════════════════════════════════

  function getSourceIds() external view returns (bytes32[] memory) {
    return sourceIds;
  }

  function getSource(
    bytes32 sourceId
  ) external view returns (EnergySource memory) {
    return sources[sourceId];
  }

  function getSourceOwnershipBps(
    bytes32 sourceId,
    address member
  ) external view returns (uint256) {
    address tokenAddr = sources[sourceId].ownershipToken;
    if (tokenAddr == address(0)) return 0;
    return _ownershipBpsOf(tokenAddr, member);
  }

  function getAllSourceOwnerships(
    address member
  ) external view returns (bytes32[] memory ids, uint256[] memory bps) {
    ids = sourceIds;
    bps = new uint256[](sourceIds.length);
    for (uint256 i = 0; i < sourceIds.length; i++) {
      address tokenAddr = sources[sourceIds[i]].ownershipToken;
      if (tokenAddr != address(0) && sources[sourceIds[i]].active) {
        bps[i] = _ownershipBpsOf(tokenAddr, member);
      }
    }
  }

  function _ownershipBpsOf(
    address tokenAddr,
    address account
  ) internal view returns (uint256) {
    IERC20 t = IERC20(tokenAddr);
    uint256 supply = t.totalSupply();
    if (supply == 0) return 0;
    return (t.balanceOf(account) * 10000) / supply;
  }

  function getMember(
    address memberAddress
  ) external view returns (Member memory) {
    require(members[memberAddress].isActive, 'Member does not exist');
    return members[memberAddress];
  }

  function getMemberAddresses() external view returns (address[] memory) {
    return memberAddresses;
  }

  function getEnergyCreditBalance(
    address account
  ) external view returns (int256) {
    return _getEnergyCreditBalance(account);
  }

  function getTokenBalance(
    address account
  ) external view returns (uint256) {
    return energyToken.balanceOf(account);
  }

  function getDebtInStablecoin(
    address debtor
  ) external view returns (uint256) {
    int256 bal = _getEnergyCreditBalance(debtor);
    if (bal >= 0) return 0;
    return uint256(-bal) * 10000;
  }

  function getCreditInStablecoin(
    address account
  ) external view returns (uint256) {
    int256 bal = _getEnergyCreditBalance(account);
    if (bal <= 0) return 0;
    return uint256(bal) * 10000;
  }

  function getContractStablecoinBalance() external view returns (uint256) {
    if (stablecoinAddress == address(0)) return 0;
    return IERC20(stablecoinAddress).balanceOf(address(this));
  }

  function verifyZeroSum() external view returns (bool, int256) {
    return _verifyZeroSum();
  }

  function getDeviceOwner(
    uint256 deviceId
  ) external view returns (address) {
    return deviceToMember[deviceId];
  }

  /// @notice Net grid balance.
  ///         negative = community imported more (owes grid)
  ///         positive = community exported more (grid owes community)
  function getGridBalance() external view returns (int256) {
    return gridBalance;
  }

  function getSettledBalance() external view returns (int256) {
    return settledBalance;
  }

  function getEnergyTokenAddress() external view returns (address) {
    return address(energyToken);
  }

  function isAddressWhitelisted(
    address account
  ) external view returns (bool) {
    return isWhitelisted[account];
  }

  function getCommunityAddress() external view returns (address) {
    return communityAddress;
  }

  function getAggregatorAddress() external view returns (address) {
    return aggregatorAddress;
  }

  function getCommunityFeeBps() external view returns (uint16) {
    return communityFeeBps;
  }

  function getAggregatorFeeBps() external view returns (uint16) {
    return aggregatorFeeBps;
  }

  function getExportDeviceId() external view returns (uint256) {
    return exportDeviceId;
  }

  function getGridOperator() external view returns (address) {
    return gridOperatorAddress;
  }
}
