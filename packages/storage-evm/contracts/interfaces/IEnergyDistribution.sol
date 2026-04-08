// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IEnergyDistribution {
  //add battery function, Zek sends in state of the battery.
  // import, localproduction. Can be split further.
  struct EnergySource {
    uint256 sourceId;
    uint256 price;
    uint256 quantity;
    bool isImport;
  }

  struct Member {
    address memberAddress;
    uint256[] deviceIds;
    uint256 ownershipPercentage; // in basis points (10000 = 100%)
    bool isActive;
  }

  struct CollectiveConsumption {
    address owner;
    uint256 price;
    uint256 quantity;
  }

  struct ConsumptionRequest {
    uint256 deviceId;
    uint256 quantity;
  }

  struct MemberConsumptionData {
    address memberAddress;
    uint256 consumed;
    uint256 allocated;
    int256 excess; // negative if under-consumed, positive if over-consumed
  }

  struct BatteryInfo {
    uint256 currentState;
    uint256 price;
    uint256 maxCapacity;
    bool configured;
  }

  function initialize(
    address initialOwner,
    address energyTokenAddress
  ) external;

  function addMember(
    address memberAddress,
    uint256[] calldata deviceIds,
    uint256 ownershipPercentage
  ) external;

  function removeMember(address memberAddress) external;

  function distributeEnergyTokens(
    EnergySource[] calldata sources,
    uint256 batteryState
  ) external;

  function consumeEnergyTokens(
    ConsumptionRequest[] calldata consumptionRequests
  ) external;

  function configureBattery(uint256 price, uint256 maxCapacity) external;

  function setExportDeviceId(uint256 deviceId) external;

  function setCommunityDeviceId(uint256 deviceId) external;

  function setExportPrice(uint256 price) external;

  function getCashCreditBalance(
    address member
  ) external view returns (int256, address);

  function getTokenBalance(address member) external view returns (uint256);

  function getEnergyTokenAddress() external view returns (address);

  function getCollectiveConsumption()
    external
    view
    returns (CollectiveConsumption[] memory);

  function getMember(
    address memberAddress
  ) external view returns (Member memory);

  function getAllocatedTokens(address member) external view returns (uint256);

  function getTotalOwnershipPercentage() external view returns (uint256);

  function getDeviceOwner(uint256 deviceId) external view returns (address);

  function getExportCashCreditBalance() external view returns (int256);

  function getBatteryInfo() external view returns (BatteryInfo memory);

  function getExportDeviceId() external view returns (uint256);

  function getCommunityDeviceId() external view returns (uint256);

  function getImportCashCreditBalance() external view returns (int256);

  function getExportPrice() external view returns (uint256);

  function getSettledBalance() external view returns (int256);

  // Settlement function for debt payment
  function settleDebt(address debtor, int256 amount) external;

  function setSettlementContract(address settlementContract) external;

  // FIX 3: Zero-sum verification function
  function verifyZeroSumProperty() external view returns (bool, int256);

  // FIX 5: Emergency reset function
  function emergencyReset() external;

  function updateWhitelist(address account, bool isWhitelisted) external;

  function setEnergyToken(address tokenAddress) external;

  function isAddressWhitelisted(address account) external view returns (bool);

  // Events
  event MemberAdded(
    address indexed memberAddress,
    uint256[] deviceIds,
    uint256 ownershipPercentage
  );
  event MemberRemoved(address indexed memberAddress);
  event EnergyDistributed(uint256 totalSources, uint256 totalQuantity);
  event EnergyConsumed(
    address indexed member,
    uint256 quantity,
    int256 cashCreditBalance
  );
  event CollectiveConsumptionUpdated(uint256 totalItems);
  event EnergyExported(uint256 totalQuantity, int256 exportValue);
  event BatteryConfigured(uint256 price, uint256 maxCapacity);
  event BatteryStateChanged(
    uint256 oldState,
    uint256 newState,
    int256 energyChange
  );
  event ExportDeviceIdSet(uint256 deviceId);
  event CommunityDeviceIdSet(uint256 deviceId);
  event ExportPriceSet(uint256 price);
  event EnergyImported(uint256 totalQuantity, int256 importCost);

  event DebtSettled(
    address indexed debtor,
    int256 amount,
    int256 previousBalance,
    int256 newBalance
  );

  event SettlementContractUpdated(
    address indexed oldContract,
    address indexed newContract
  );

  event WhitelistUpdated(address indexed account, bool isWhitelisted);

  // FIX 5: Emergency reset event
  event EmergencyReset();

  // DEBUG: Events for diagnosing consumption issues
  event DebugConsumptionAttempt(
    uint256 indexed poolIndex,
    address owner,
    uint256 quantityBefore,
    uint256 canConsume,
    uint256 quantityAfter
  );
  event DebugConsumptionLoopInfo(
    uint256 collectiveLength,
    uint256 remainingToConsume,
    bool isFirstPass
  );
  event DebugPoolStateAfterConsumption(uint256 totalRemainingInPool);
}
