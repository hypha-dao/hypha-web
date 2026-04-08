// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './EnergyToken.sol';
import './EnergySourceToken.sol';

/// @title  EnergyPPAv2
/// @notice On-chain per-source energy settlement for a community.
///
///         Each energy source (solar park, battery, etc.) has its own ERC-20
///         ownership token (EnergySourceToken). Revenue from each source is
///         split on-chain to that source's token holders — proportional to
///         their token balance.
///
///         consumeEnergy() does everything in two phases:
///
///         Phase 1 — Charge consumers:
///           Each reading debits the consumer at the reading's price.
///           Revenue accumulates per source. Import charges go to importBalance.
///
///         Phase 2 — Split revenue per source:
///           For each source: community fee → aggregator fee → remainder to
///           that source's EnergySourceToken holders by balance proportion.
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
    address ownershipToken; // EnergySourceToken address
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
    uint256[] deviceIds; // empty for pure investors (e.g. Eve)
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
  mapping(address => int256) internal cashCreditBalances;
  int256 internal importCashCreditBalance;
  int256 internal exportCashCreditBalance;
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
  event WhitelistUpdated(address indexed account, bool isWhitelisted);
  event ExportDeviceIdSet(uint256 deviceId);
  event EmergencyReset();

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
    address _paymentRecipient
  ) public initializer {
    __Ownable_init(initialOwner);
    __UUPSUpgradeable_init();
    __ReentrancyGuard_init();

    energyToken = EnergyToken(_energyToken);
    stablecoinAddress = _stablecoin;
    paymentRecipient = _paymentRecipient;
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

  /// @notice Register a new energy source. Deploy an EnergySourceToken first,
  ///         distribute tokens to investors, then register the source here.
  ///         The token's balance distribution determines revenue shares.
  ///         basePricePerKwh is the agreed PPA reference price — stored on-chain
  ///         for transparency but not enforced. The backend reads it, may adjust
  ///         it (time-of-use, spot market, etc.), and passes the final price
  ///         in each ConsumptionReading.
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
        exportCashCreditBalance -= int256(revenue);
        emit EnergyExported(r.quantity, revenue, r.sourceId);
        continue;
      }

      address consumer = deviceToMember[r.deviceId];
      require(consumer != address(0), 'Device not found');
      require(members[consumer].isActive, 'Member not active');

      uint256 charge = r.quantity * r.pricePerKwh;
      _adjustCashCreditBalance(consumer, -int256(charge));

      // ── Grid import ──
      if (r.sourceId == IMPORT_SOURCE_ID) {
        importCashCreditBalance += int256(charge);
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
      _adjustCashCreditBalance(communityAddress, int256(fee));
      remaining -= fee;
      emit CommunityFeeCollected(communityAddress, fee, sourceId);
    }

    // Aggregator fee
    if (aggregatorFeeBps > 0 && aggregatorAddress != address(0)) {
      uint256 fee = (totalRevenue * aggregatorFeeBps) / 10000;
      _adjustCashCreditBalance(aggregatorAddress, int256(fee));
      remaining -= fee;
      emit AggregatorFeeCollected(aggregatorAddress, fee, sourceId);
    }

    if (remaining == 0) return;

    // Read this source's ownership token
    address tokenAddr = sources[sourceId].ownershipToken;
    EnergySourceToken token = EnergySourceToken(tokenAddr);
    uint256 totalSupply = token.totalSupply();
    if (totalSupply == 0) return;

    // Find the last member with a non-zero balance (gets the remainder)
    address lastHolder = address(0);
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      if (token.balanceOf(memberAddresses[i]) > 0) {
        lastHolder = memberAddresses[i];
      }
    }
    if (lastHolder == address(0)) return;

    // Distribute proportionally by token balance
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
        _adjustCashCreditBalance(addr, int256(share));
        emit RevenueDistributed(addr, share, sourceId, totalRevenue);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Members
  // ════════════════════════════════════════════════════════════════════════

  /// @notice Add a community member or investor.
  ///         Ownership is NOT stored here — it lives in the EnergySourceTokens.
  ///         Pass empty deviceIds for pure investors (no meter, just revenue).
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
    delete cashCreditBalances[memberAddress];

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

    int256 balance = _getCashCreditBalance(debtor);
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
    if (paymentRecipient != address(0)) {
      require(
        coin.transfer(paymentRecipient, requiredStablecoin),
        'Forward failed'
      );
    }

    int256 prev = balance;
    int256 newBal = balance + int256(settle);
    if (newBal > 0) newBal = 0;

    _setCashCreditBalance(debtor, newBal);
    settledBalance -= int256(settle);

    emit DebtSettled(msg.sender, debtor, requiredStablecoin, prev, newBal);
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

  function emergencyReset() external onlyWhitelist {
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      _setCashCreditBalance(memberAddresses[i], 0);
    }
    if (communityAddress != address(0)) {
      _setCashCreditBalance(communityAddress, 0);
    }
    if (aggregatorAddress != address(0)) {
      _setCashCreditBalance(aggregatorAddress, 0);
    }
    importCashCreditBalance = 0;
    exportCashCreditBalance = 0;
    settledBalance = 0;
    emit EmergencyReset();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Internal: balance management (same dual representation as v1)
  // ════════════════════════════════════════════════════════════════════════

  function _getCashCreditBalance(
    address account
  ) internal view returns (int256) {
    uint256 tokenBal = energyToken.balanceOf(account);
    return tokenBal > 0 ? int256(tokenBal) : cashCreditBalances[account];
  }

  function _setCashCreditBalance(address account, int256 amount) internal {
    uint256 current = energyToken.balanceOf(account);
    if (current > 0) energyToken.burn(account, current);
    cashCreditBalances[account] = 0;

    if (amount > 0) {
      energyToken.transfer(account, uint256(amount));
    } else if (amount < 0) {
      cashCreditBalances[account] = amount;
    }
  }

  function _adjustCashCreditBalance(
    address account,
    int256 adjustment
  ) internal {
    _setCashCreditBalance(
      account,
      _getCashCreditBalance(account) + adjustment
    );
  }

  function _verifyZeroSum() internal view returns (bool, int256) {
    int256 total = 0;
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      total += _getCashCreditBalance(memberAddresses[i]);
    }
    if (communityAddress != address(0)) {
      total += _getCashCreditBalance(communityAddress);
    }
    if (aggregatorAddress != address(0)) {
      total += _getCashCreditBalance(aggregatorAddress);
    }
    total +=
      importCashCreditBalance +
      exportCashCreditBalance +
      settledBalance;
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

  /// @notice Get a member's ownership of a specific source in basis points.
  function getSourceOwnershipBps(
    bytes32 sourceId,
    address member
  ) external view returns (uint256) {
    address tokenAddr = sources[sourceId].ownershipToken;
    if (tokenAddr == address(0)) return 0;
    return EnergySourceToken(tokenAddr).ownershipBpsOf(member);
  }

  /// @notice Bulk: for each source, return the member's ownership bps.
  function getAllSourceOwnerships(
    address member
  ) external view returns (bytes32[] memory ids, uint256[] memory bps) {
    ids = sourceIds;
    bps = new uint256[](sourceIds.length);
    for (uint256 i = 0; i < sourceIds.length; i++) {
      address tokenAddr = sources[sourceIds[i]].ownershipToken;
      if (tokenAddr != address(0) && sources[sourceIds[i]].active) {
        bps[i] = EnergySourceToken(tokenAddr).ownershipBpsOf(member);
      }
    }
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

  function getCashCreditBalance(
    address account
  ) external view returns (int256) {
    return _getCashCreditBalance(account);
  }

  function getTokenBalance(
    address account
  ) external view returns (uint256) {
    return energyToken.balanceOf(account);
  }

  function getDebtInStablecoin(
    address debtor
  ) external view returns (uint256) {
    int256 bal = _getCashCreditBalance(debtor);
    if (bal >= 0) return 0;
    return uint256(-bal) * 10000;
  }

  function verifyZeroSum() external view returns (bool, int256) {
    return _verifyZeroSum();
  }

  function getDeviceOwner(
    uint256 deviceId
  ) external view returns (address) {
    return deviceToMember[deviceId];
  }

  function getImportCashCreditBalance() external view returns (int256) {
    return importCashCreditBalance;
  }

  function getExportCashCreditBalance() external view returns (int256) {
    return exportCashCreditBalance;
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

  function getCommunityFeeBps() external view returns (uint16) {
    return communityFeeBps;
  }

  function getAggregatorFeeBps() external view returns (uint16) {
    return aggregatorFeeBps;
  }
}
