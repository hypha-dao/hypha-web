// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/NanoPPAStorage.sol';
import './interfaces/INanoPPA.sol';
import './interfaces/IDistanceOracle.sol';
import './interfaces/IEnergyDistribution.sol';

/// @title  NanoPPAFactory
/// @notice Creates and settles bilateral nanoPPA energy agreements on-chain.
///         Each agreement represents a 15-minute-interval energy contract between
///         a producer and a consumer within an EU Renewable Energy Community.
///
///         Settlement is ex-post: an oracle posts meter data after each interval,
///         this contract computes allocated kWh and price, then calls
///         EnergyDistributionImplementation.recordBilateralSettlement() to adjust
///         cash credit balances.  Actual stablecoin (EURe/EUROC) settlement
///         happens later via EnergySettlement — same flow as the rest of the system.
contract NanoPPAFactory is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  NanoPPAStorage,
  INanoPPA
{
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address initialOwner,
    address _energyDistribution,
    address _distanceOracle,
    address _defaultAggregator
  ) public initializer {
    __Ownable_init(initialOwner);
    __UUPSUpgradeable_init();

    energyDistribution = IEnergyDistribution(_energyDistribution);
    distanceOracle = IDistanceOracle(_distanceOracle);
    defaultAggregator = _defaultAggregator;
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  // ══════════════════════════════════════════════════════════════════════
  //  Modifiers
  // ══════════════════════════════════════════════════════════════════════

  modifier onlyOracle() {
    require(isOracle[msg.sender], 'Caller is not an oracle');
    _;
  }

  modifier onlyParty(bytes32 agreementId) {
    Agreement storage a = agreements[agreementId];
    require(
      msg.sender == a.producer ||
        msg.sender == a.consumer ||
        msg.sender == a.aggregator,
      'Not a party to this agreement'
    );
    _;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Agreement Creation
  // ══════════════════════════════════════════════════════════════════════

  function createAgreement(
    CreateParams calldata params
  ) external override returns (bytes32) {
    require(params.producer != address(0), 'Invalid producer');
    require(params.consumer != address(0), 'Invalid consumer');
    require(params.producer != params.consumer, 'Same address for both sides');
    require(
      params.sharingKeyBps > 0 && params.sharingKeyBps <= 10000,
      'Sharing key out of range'
    );

    address aggregator = params.aggregator != address(0)
      ? params.aggregator
      : defaultAggregator;
    uint8 intervalMin = params.intervalMinutes > 0
      ? params.intervalMinutes
      : 15;

    require(aggregator != address(0), 'No aggregator configured');

    // ── Geographic validation via oracle ──────────────────────────────
    bool distanceOk = true;
    if (address(distanceOracle) != address(0)) {
      distanceOk = distanceOracle.validate(
        params.gpsLatProducer,
        params.gpsLonProducer,
        params.gpsLatConsumer,
        params.gpsLonConsumer,
        params.countryCode,
        params.voltageLevel
      );
    }
    require(distanceOk, 'REC distance rule violated');

    // ── REC membership (stub — validated off-chain or via future module) ─
    bool memberOk = true;

    // ── Generate unique agreement ID ─────────────────────────────────
    bytes32 agreementId = keccak256(
      abi.encodePacked(
        params.producer,
        params.consumer,
        block.timestamp,
        agreementIds.length
      )
    );

    // ── Persist agreement ────────────────────────────────────────────
    Agreement storage a = agreements[agreementId];
    a.id = agreementId;
    a.createdAt = block.timestamp;
    a.status = AgreementStatus.ACTIVE;
    a.productType = params.productType;
    a.producer = params.producer;
    a.consumer = params.consumer;
    a.aggregator = aggregator;
    a.sharingKeyType = params.sharingKeyType;
    a.sharingKeyBps = params.sharingKeyBps;
    a.intervalMinutes = intervalMin;
    a.aggregatorFeeBps = params.aggregatorFeeBps;
    a.stablecoin = params.stablecoin;
    a.countryCode = params.countryCode;
    a.distanceValidated = distanceOk;
    a.memberValidated = memberOk;
    a.metadataHash = params.metadataHash;

    // ── Indexes ──────────────────────────────────────────────────────
    agreementIds.push(agreementId);
    producerAgreements[params.producer].push(agreementId);
    consumerAgreements[params.consumer].push(agreementId);

    emit AgreementCreated(
      agreementId,
      params.producer,
      params.consumer,
      params.countryCode,
      params.productType,
      block.timestamp
    );

    return agreementId;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Interval Settlement
  // ══════════════════════════════════════════════════════════════════════

  /// @notice Settle a single 15-min interval for one agreement.
  ///         Called by a whitelisted oracle after meter data is available.
  ///         Adjusts cash credit balances inside EnergyDistribution:
  ///         producer is credited, consumer is debited, aggregator fee
  ///         goes to the community balance.
  function settleInterval(
    bytes32 agreementId,
    IntervalData calldata data
  ) external override onlyOracle {
    _settleInterval(agreementId, data);
  }

  /// @notice Settle multiple agreements for the same 15-min window in one tx.
  function batchSettleIntervals(
    bytes32[] calldata _agreementIds,
    IntervalData[] calldata data
  ) external override onlyOracle {
    require(_agreementIds.length == data.length, 'Length mismatch');
    for (uint256 i = 0; i < _agreementIds.length; i++) {
      _settleInterval(_agreementIds[i], data[i]);
    }
  }

  function _settleInterval(
    bytes32 agreementId,
    IntervalData calldata data
  ) internal {
    Agreement storage a = agreements[agreementId];
    require(a.status == AgreementStatus.ACTIVE, 'Agreement not active');
    require(
      data.intervalStart > lastSettledInterval[agreementId],
      'Interval already settled'
    );
    require(
      data.producerKwh > 0 || data.consumerKwh > 0,
      'No energy data'
    );

    consecutiveMissing[agreementId] = 0;

    // ── 1. Compute allocated kWh ─────────────────────────────────────
    uint256 allocatedKwh = _computeAllocation(a, data);

    // ── 2. Compute settlement amount (ex-post) ──────────────────────
    uint256 settlementAmount = _computeSettlement(allocatedKwh, data);

    // ── 3. Compute aggregator fee ───────────────────────────────────
    uint256 fee = (settlementAmount * a.aggregatorFeeBps) / 10000;

    // ── 4. Update nanoPPA running totals ────────────────────────────
    a.totalKwhSettled += allocatedKwh;
    a.totalEurSettled += settlementAmount;
    a.intervalsSettled++;
    lastSettledInterval[agreementId] = data.intervalStart;

    // ── 5. Record in EnergyDistribution (adjusts cash credit balances) ─
    if (settlementAmount > 0) {
      energyDistribution.recordBilateralSettlement(
        a.producer,
        a.consumer,
        int256(settlementAmount),
        int256(fee)
      );
    }

    emit IntervalSettled(
      agreementId,
      data.intervalStart,
      allocatedKwh,
      settlementAmount,
      false
    );
  }

  /// @notice Record an interval where oracle data is missing.
  ///         No balance changes occur; flagged for later reconciliation.
  ///         Auto-raises a dispute after 3 consecutive missing intervals.
  function settleIntervalEstimated(
    bytes32 agreementId,
    uint256 intervalStart
  ) external onlyOracle {
    Agreement storage a = agreements[agreementId];
    require(a.status == AgreementStatus.ACTIVE, 'Agreement not active');
    require(
      intervalStart > lastSettledInterval[agreementId],
      'Interval already settled'
    );

    consecutiveMissing[agreementId]++;

    if (consecutiveMissing[agreementId] >= 3) {
      emit DisputeRaised(
        agreementId,
        intervalStart,
        address(this),
        '3+ consecutive missing intervals'
      );
    }

    lastSettledInterval[agreementId] = intervalStart;

    emit IntervalSettled(agreementId, intervalStart, 0, 0, true);
  }

  // ── Allocation helpers ──────────────────────────────────────────────

  function _computeAllocation(
    Agreement storage a,
    IntervalData calldata data
  ) internal view returns (uint256) {
    if (a.sharingKeyType == SharingKeyType.STATIC) {
      uint256 allocated = (data.producerKwh * a.sharingKeyBps) / 10000;
      return allocated > data.consumerKwh ? data.consumerKwh : allocated;
    }

    // DYNAMIC & PRIORITY: bilateral min(production, consumption).
    // Multi-consumer priority dispatch requires an off-chain ordering step
    // that feeds per-agreement allocations through the oracle.
    return
      data.producerKwh < data.consumerKwh
        ? data.producerKwh
        : data.consumerKwh;
  }

  /// @dev  allocatedKwh is ×1e4, spotPriceEur is in the same unit scale
  ///       as EnergyDistribution's internal cash credits (set by oracle).
  function _computeSettlement(
    uint256 allocatedKwh,
    IntervalData calldata data
  ) internal pure returns (uint256) {
    if (allocatedKwh == 0) return 0;
    return (allocatedKwh * data.spotPriceEur) / 1e4;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Agreement Lifecycle
  // ══════════════════════════════════════════════════════════════════════

  function suspendAgreement(
    bytes32 agreementId
  ) external override onlyParty(agreementId) {
    Agreement storage a = agreements[agreementId];
    require(a.status == AgreementStatus.ACTIVE, 'Not active');
    a.status = AgreementStatus.SUSPENDED;
    emit AgreementSuspended(agreementId);
  }

  function resumeAgreement(
    bytes32 agreementId
  ) external override onlyParty(agreementId) {
    Agreement storage a = agreements[agreementId];
    require(a.status == AgreementStatus.SUSPENDED, 'Not suspended');
    a.status = AgreementStatus.ACTIVE;
    emit AgreementResumed(agreementId);
  }

  function terminateAgreement(
    bytes32 agreementId,
    string calldata reason
  ) external override onlyParty(agreementId) {
    Agreement storage a = agreements[agreementId];
    require(a.status != AgreementStatus.TERMINATED, 'Already terminated');
    a.status = AgreementStatus.TERMINATED;
    emit AgreementTerminated(agreementId, reason, a.totalEurSettled);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Dispute Resolution
  // ══════════════════════════════════════════════════════════════════════

  function raiseDispute(
    bytes32 agreementId,
    uint256 intervalStart,
    string calldata reason
  ) external override onlyParty(agreementId) {
    require(
      agreements[agreementId].status != AgreementStatus.TERMINATED,
      'Agreement terminated'
    );
    emit DisputeRaised(agreementId, intervalStart, msg.sender, reason);
  }

  /// @notice Resolve a dispute. Only the contract owner (or a future
  ///         arbitration module) can call this.  Adjusts the agreement's
  ///         running totals to reflect the panel/legal decision.
  function resolveDispute(
    bytes32 agreementId,
    uint256 adjustedKwh,
    uint256 adjustedEur,
    ResolutionMethod method
  ) external override onlyOwner {
    require(
      agreements[agreementId].id != bytes32(0),
      'Agreement not found'
    );

    Agreement storage a = agreements[agreementId];
    a.totalKwhSettled = adjustedKwh;
    a.totalEurSettled = adjustedEur;

    emit DisputeResolved(agreementId, adjustedKwh, adjustedEur, method);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Admin
  // ══════════════════════════════════════════════════════════════════════

  function setDistanceOracle(address oracle) external onlyOwner {
    distanceOracle = IDistanceOracle(oracle);
  }

  function setEnergyDistribution(address _energyDistribution) external onlyOwner {
    energyDistribution = IEnergyDistribution(_energyDistribution);
  }

  function updateOracleWhitelist(
    address oracle,
    bool allowed
  ) external onlyOwner {
    isOracle[oracle] = allowed;
  }

  function setDefaultAggregator(address aggregator) external onlyOwner {
    defaultAggregator = aggregator;
  }

  function setMembershipValidator(address validator) external onlyOwner {
    membershipValidator = validator;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  View Functions
  // ══════════════════════════════════════════════════════════════════════

  function getAgreement(
    bytes32 agreementId
  ) external view override returns (Agreement memory) {
    return agreements[agreementId];
  }

  function getAgreementsByProducer(
    address producer
  ) external view override returns (bytes32[] memory) {
    return producerAgreements[producer];
  }

  function getAgreementsByConsumer(
    address consumer
  ) external view override returns (bytes32[] memory) {
    return consumerAgreements[consumer];
  }

  function getLastSettledInterval(
    bytes32 agreementId
  ) external view override returns (uint256) {
    return lastSettledInterval[agreementId];
  }

  function getAgreementCount() external view override returns (uint256) {
    return agreementIds.length;
  }

  function getConsecutiveMissing(
    bytes32 agreementId
  ) external view returns (uint8) {
    return consecutiveMissing[agreementId];
  }

  function isOracleWhitelisted(address oracle) external view returns (bool) {
    return isOracle[oracle];
  }

  function getDefaultAggregator() external view returns (address) {
    return defaultAggregator;
  }

  function getEnergyDistributionAddress() external view returns (address) {
    return address(energyDistribution);
  }
}
