// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface INanoPPA {
  // ── Enums ──────────────────────────────────────────────────────────────

  enum ProductType {
    ENERGY_DELIVERY,
    ENERGY_FLEXIBILITY,
    ENERGY_REDUCTION,
    GRANULAR_GOO,
    AVOIDED_CARBON_CREDITS
  }

  enum SharingKeyType {
    STATIC,
    DYNAMIC,
    PRIORITY
  }

  enum AgreementStatus {
    PENDING,
    ACTIVE,
    SUSPENDED,
    TERMINATED
  }

  enum ResolutionMethod {
    AUTO,
    PANEL,
    LEGAL
  }

  // ── Structs ────────────────────────────────────────────────────────────

  /// @notice On-chain representation of a bilateral nanoPPA agreement.
  ///         Full party details (meter IDs, GPS, entity types, legal terms)
  ///         are stored off-chain and referenced via `metadataHash`.
  struct Agreement {
    bytes32 id;
    uint256 createdAt;
    AgreementStatus status;
    ProductType productType;
    // Parties
    address producer;
    address consumer;
    address aggregator;
    // Settlement configuration
    SharingKeyType sharingKeyType;
    uint16 sharingKeyBps; // basis points (10000 = 100%)
    uint8 intervalMinutes; // default 15
    uint16 aggregatorFeeBps; // basis points
    address stablecoin;
    // Compliance (validated at creation, details in metadata)
    bytes2 countryCode; // ISO 3166-1 alpha-2
    bool distanceValidated;
    bool memberValidated;
    // Off-chain metadata pointer
    bytes32 metadataHash; // IPFS CID containing full NanoPPA details
    // Running totals
    uint256 totalKwhSettled; // ×1e4
    uint256 totalEurSettled; // ×1e6
    uint32 intervalsSettled;
  }

  /// @notice Parameters required to create a new nanoPPA agreement.
  struct CreateParams {
    address producer;
    address consumer;
    address aggregator; // address(0) → use factory default
    ProductType productType;
    SharingKeyType sharingKeyType;
    uint16 sharingKeyBps;
    uint8 intervalMinutes; // 0 → default 15
    uint16 aggregatorFeeBps;
    address stablecoin; // address(0) → use factory default
    bytes2 countryCode;
    uint8 voltageLevel; // 0=LV, 1=MV, 2=HV, 3=EHV
    int64 gpsLatProducer; // ×1e6
    int64 gpsLonProducer;
    int64 gpsLatConsumer;
    int64 gpsLonConsumer;
    bytes32 metadataHash;
  }

  /// @notice Oracle-reported meter data for a single 15-min interval.
  struct IntervalData {
    uint256 intervalStart; // Unix timestamp of interval open
    uint256 producerKwh; // ×1e4
    uint256 consumerKwh; // ×1e4
    uint256 gridImportKwh; // ×1e4
    uint256 gridExportKwh; // ×1e4
    int256 batteryDeltaKwh; // ×1e4 (positive = charging, negative = discharging)
    uint256 spotPriceEur; // ×1e6 per kWh
  }

  // ── Events ─────────────────────────────────────────────────────────────

  event AgreementCreated(
    bytes32 indexed agreementId,
    address indexed producer,
    address indexed consumer,
    bytes2 countryCode,
    ProductType productType,
    uint256 timestamp
  );

  event IntervalSettled(
    bytes32 indexed agreementId,
    uint256 intervalStart,
    uint256 kwhDelivered, // ×1e4
    uint256 eurSettled, // ×1e6
    bool estimated
  );

  event CertificateIssued(
    bytes32 indexed agreementId,
    bytes32 certificateId,
    uint256 mwh, // ×1e4
    uint256 productionTimestamp,
    string registryDomain
  );

  event DisputeRaised(
    bytes32 indexed agreementId,
    uint256 intervalStart,
    address raisedBy,
    string reason
  );

  event DisputeResolved(
    bytes32 indexed agreementId,
    uint256 adjustedKwh,
    uint256 adjustedEur,
    ResolutionMethod method
  );

  event AgreementTerminated(
    bytes32 indexed agreementId,
    string reason,
    uint256 finalSettlementEur
  );

  event AgreementSuspended(bytes32 indexed agreementId);
  event AgreementResumed(bytes32 indexed agreementId);

  // ── Functions ──────────────────────────────────────────────────────────

  function createAgreement(
    CreateParams calldata params
  ) external returns (bytes32);

  function settleInterval(
    bytes32 agreementId,
    IntervalData calldata data
  ) external;

  function batchSettleIntervals(
    bytes32[] calldata agreementIds,
    IntervalData[] calldata data
  ) external;

  function suspendAgreement(bytes32 agreementId) external;

  function resumeAgreement(bytes32 agreementId) external;

  function terminateAgreement(
    bytes32 agreementId,
    string calldata reason
  ) external;

  function raiseDispute(
    bytes32 agreementId,
    uint256 intervalStart,
    string calldata reason
  ) external;

  function resolveDispute(
    bytes32 agreementId,
    uint256 adjustedKwh,
    uint256 adjustedEur,
    ResolutionMethod method
  ) external;

  // ── View ───────────────────────────────────────────────────────────────

  function getAgreement(
    bytes32 agreementId
  ) external view returns (Agreement memory);

  function getAgreementsByProducer(
    address producer
  ) external view returns (bytes32[] memory);

  function getAgreementsByConsumer(
    address consumer
  ) external view returns (bytes32[] memory);

  function getLastSettledInterval(
    bytes32 agreementId
  ) external view returns (uint256);

  function getAgreementCount() external view returns (uint256);
}
