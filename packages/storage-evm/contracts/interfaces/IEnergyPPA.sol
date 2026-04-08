// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IEnergyPPA {
  enum Source {
    LOCAL,
    IMPORT
  }

  struct MemberPPA {
    address memberAddress;
    uint256[] deviceIds;
    uint256 ownershipBps; // 10000 = 100%, only for members/investors
    bool isActive;
    bytes32 metadataHash;
  }

  struct ConsumptionReading {
    uint256 deviceId;
    uint256 quantity;
    uint256 pricePerKwh;
    Source source;
  }

  // ── Core ───────────────────────────────────────────────────────────────

  function consumeEnergy(ConsumptionReading[] calldata readings) external;

  // ── Members ────────────────────────────────────────────────────────────

  function addMember(
    address memberAddress,
    uint256[] calldata deviceIds,
    uint256 ownershipBps,
    bytes32 metadataHash
  ) external;
  function removeMember(address memberAddress) external;

  // ── Settlement ─────────────────────────────────────────────────────────

  function settleDebt(address debtor, uint256 stablecoinAmount) external;
  function settleOwnDebt(uint256 stablecoinAmount) external;

  // ── Config ─────────────────────────────────────────────────────────────

  function setExportDeviceId(uint256 deviceId) external;
  function setExportPrice(uint256 price) external;
  function setCommunityAddress(address addr) external;
  function setAggregatorAddress(address addr) external;
  function setCommunityFeeBps(uint16 bps) external;
  function setAggregatorFeeBps(uint16 bps) external;
  function setPaymentRecipient(address recipient) external;
  function updateWhitelist(address account, bool _isWhitelisted) external;
  function setEnergyToken(address tokenAddress) external;
  function setStablecoin(address tokenAddress) external;
  function emergencyReset() external;

  // ── Views ──────────────────────────────────────────────────────────────

  function getMember(address memberAddress) external view returns (MemberPPA memory);
  function getCashCreditBalance(address member) external view returns (int256);
  function getTokenBalance(address member) external view returns (uint256);
  function getDebtInStablecoin(address debtor) external view returns (uint256);
  function verifyZeroSum() external view returns (bool, int256);
  function getTotalOwnershipBps() external view returns (uint256);
  function getDeviceOwner(uint256 deviceId) external view returns (address);
  function getImportCashCreditBalance() external view returns (int256);
  function getExportCashCreditBalance() external view returns (int256);
  function getSettledBalance() external view returns (int256);
  function getExportPrice() external view returns (uint256);
  function getEnergyTokenAddress() external view returns (address);
  function isAddressWhitelisted(address account) external view returns (bool);
  function getCommunityFeeBps() external view returns (uint16);
  function getAggregatorFeeBps() external view returns (uint16);

  // ── Events ─────────────────────────────────────────────────────────────

  event MemberAdded(address indexed member, uint256 ownershipBps);
  event MemberRemoved(address indexed member);

  event EnergyConsumed(
    address indexed consumer,
    uint256 quantity,
    uint256 pricePerKwh,
    Source source
  );
  event RevenueDistributed(address indexed owner, uint256 amount, uint256 totalRevenue);
  event CommunityFeeCollected(address indexed community, uint256 amount);
  event AggregatorFeeCollected(address indexed aggregator, uint256 amount);
  event EnergyExported(uint256 quantity, uint256 revenue);

  event DebtSettled(
    address indexed payer,
    address indexed debtor,
    uint256 stablecoinAmount,
    int256 previousBalance,
    int256 newBalance
  );
  event WhitelistUpdated(address indexed account, bool isWhitelisted);
  event ExportDeviceIdSet(uint256 deviceId);
  event ExportPriceSet(uint256 price);
  event EmergencyReset();
}
