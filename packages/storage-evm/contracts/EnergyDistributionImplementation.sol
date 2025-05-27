// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/EnergyDistributionStorage.sol';
import './interfaces/IEnergyDistribution.sol';

contract EnergyDistributionImplementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  EnergyDistributionStorage,
  IEnergyDistribution
{
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address initialOwner) public initializer {
    __Ownable_init(initialOwner);
    __UUPSUpgradeable_init();

    totalOwnershipPercentage = 0;
    batteryCurrentState = 0;
    batteryConfigured = false;
    exportDeviceId = 0;
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  function configureBattery(
    uint256 price,
    uint256 maxCapacity
  ) external override onlyOwner {
    require(price > 0, 'Battery price must be greater than 0');
    require(maxCapacity > 0, 'Battery max capacity must be greater than 0');

    batteryPrice = price;
    batteryMaxCapacity = maxCapacity;
    batteryConfigured = true;

    emit BatteryConfigured(price, maxCapacity);
  }

  function setExportDeviceId(uint256 deviceId) external override onlyOwner {
    exportDeviceId = deviceId;
    emit ExportDeviceIdSet(deviceId);
  }

  function addMember(
    address memberAddress,
    uint256[] calldata deviceIds,
    uint256 ownershipPercentage
  ) external override onlyOwner {
    require(memberAddress != address(0), 'Invalid member address');
    require(deviceIds.length > 0, 'No device IDs provided');
    require(
      ownershipPercentage > 0,
      'Ownership percentage must be greater than 0'
    );
    require(!members[memberAddress].isActive, 'Member already exists');
    require(
      totalOwnershipPercentage + ownershipPercentage <= 10000,
      'Total ownership exceeds 100%'
    );

    // Check device IDs are not already assigned
    for (uint256 i = 0; i < deviceIds.length; i++) {
      require(
        deviceToMember[deviceIds[i]] == address(0),
        'Device ID already assigned'
      );
    }

    // Create member
    members[memberAddress] = Member({
      memberAddress: memberAddress,
      deviceIds: deviceIds,
      ownershipPercentage: ownershipPercentage,
      isActive: true
    });

    memberAddresses.push(memberAddress);
    totalOwnershipPercentage += ownershipPercentage;

    // Map device IDs to member
    for (uint256 i = 0; i < deviceIds.length; i++) {
      deviceToMember[deviceIds[i]] = memberAddress;
    }

    emit MemberAdded(memberAddress, deviceIds, ownershipPercentage);
  }

  function removeMember(address memberAddress) external override onlyOwner {
    require(members[memberAddress].isActive, 'Member does not exist');

    Member memory member = members[memberAddress];

    // Remove device mappings
    for (uint256 i = 0; i < member.deviceIds.length; i++) {
      delete deviceToMember[member.deviceIds[i]];
    }

    // Update total ownership percentage
    totalOwnershipPercentage -= member.ownershipPercentage;

    // Remove from member addresses array
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      if (memberAddresses[i] == memberAddress) {
        memberAddresses[i] = memberAddresses[memberAddresses.length - 1];
        memberAddresses.pop();
        break;
      }
    }

    // Clear member data
    delete members[memberAddress];
    delete allocatedTokens[memberAddress];
    delete cashCreditBalances[memberAddress];

    emit MemberRemoved(memberAddress);
  }

  function distributeEnergyTokens(
    EnergySource[] calldata sources,
    uint256 batteryState
  ) external override onlyOwner {
    require(sources.length > 0, 'No sources provided');
    require(totalOwnershipPercentage == 10000, 'Total ownership must be 100%');

    // Handle battery state changes
    int256 batteryEnergyChange = 0;
    uint256 oldBatteryState = batteryCurrentState;

    if (batteryState != batteryCurrentState) {
      if (batteryState > batteryCurrentState) {
        // Battery charging - deduct from local production
        batteryEnergyChange = int256(batteryState - batteryCurrentState);
      } else {
        // Battery discharging - add as production source
        batteryEnergyChange = -int256(batteryCurrentState - batteryState);
      }

      batteryCurrentState = batteryState;
      emit BatteryStateChanged(
        oldBatteryState,
        batteryState,
        batteryEnergyChange
      );
    }

    // Clear previous distribution
    delete collectiveConsumption;
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      allocatedTokens[memberAddresses[i]] = 0;
    }

    uint256 totalQuantity = 0;
    EnergySource[] memory adjustedSources = new EnergySource[](
      sources.length + (batteryEnergyChange < 0 ? 1 : 0)
    );
    uint256 adjustedSourcesCount = 0;

    // Process each source and handle battery charging/discharging
    for (uint256 i = 0; i < sources.length; i++) {
      EnergySource memory source = sources[i];

      // If this is local production (sourceId 1) and battery is charging, deduct the charging amount
      if (source.sourceId == 1 && batteryEnergyChange > 0) {
        require(
          source.quantity >= uint256(batteryEnergyChange),
          'Insufficient local production for battery charging'
        );
        source.quantity -= uint256(batteryEnergyChange);
      }

      if (source.quantity > 0) {
        adjustedSources[adjustedSourcesCount] = source;
        adjustedSourcesCount++;
        totalQuantity += source.quantity;
      }
    }

    // If battery is discharging, add it as a production source
    if (batteryEnergyChange < 0) {
      require(
        batteryConfigured,
        'Battery must be configured before discharging'
      );
      adjustedSources[adjustedSourcesCount] = EnergySource({
        sourceId: 999, // Special ID for battery discharge
        price: batteryPrice,
        quantity: uint256(-batteryEnergyChange)
      });
      adjustedSourcesCount++;
      totalQuantity += uint256(-batteryEnergyChange);
    }

    // Distribute energy tokens from all sources (including battery discharge if any)
    for (uint256 i = 0; i < adjustedSourcesCount; i++) {
      EnergySource memory source = adjustedSources[i];
      uint256 totalDistributed = 0;

      // Distribute to each member based on ownership percentage
      for (uint256 j = 0; j < memberAddresses.length; j++) {
        address memberAddr = memberAddresses[j];
        Member memory member = members[memberAddr];

        uint256 memberShare;

        // For the last member, give them exactly what's left to ensure no rounding errors
        if (j == memberAddresses.length - 1) {
          memberShare = source.quantity - totalDistributed;
        } else {
          memberShare = (source.quantity * member.ownershipPercentage) / 10000;
          totalDistributed += memberShare;
        }

        if (memberShare > 0) {
          allocatedTokens[memberAddr] += memberShare;

          // Add to collective consumption list
          collectiveConsumption.push(
            CollectiveConsumption({
              owner: memberAddr,
              price: source.price,
              quantity: memberShare
            })
          );
        }
      }
    }

    // Sort collective consumption by price (ascending)
    _sortCollectiveConsumptionByPrice();

    emit EnergyDistributed(adjustedSourcesCount, totalQuantity);
    emit CollectiveConsumptionUpdated(collectiveConsumption.length);
  }

  // Add a new struct to temporarily hold consumption details per member for a batch
  struct BatchConsumptionDetails {
    uint256 totalRequested;
    uint256 selfConsumed;
    uint256 toBuy; // for over-consumers
    int256 cashCreditChange; // net change for this batch
  }
  mapping(address => BatchConsumptionDetails) private batchDetails;

  function consumeEnergyTokens(
    ConsumptionRequest[] calldata requests
  ) external override onlyOwner {
    require(requests.length > 0, 'No consumption requests provided');
    _sortCollectiveConsumptionByPrice();

    // Separate export requests from regular consumption requests
    ConsumptionRequest[] memory regularRequests = new ConsumptionRequest[](
      requests.length
    );
    ConsumptionRequest[] memory exportRequests = new ConsumptionRequest[](
      requests.length
    );
    uint256 regularCount = 0;
    uint256 exportCount = 0;

    for (uint256 i = 0; i < requests.length; i++) {
      if (requests[i].deviceId == exportDeviceId) {
        exportRequests[exportCount] = requests[i];
        exportCount++;
      } else {
        regularRequests[regularCount] = requests[i];
        regularCount++;
      }
    }

    // Process regular consumption requests first
    if (regularCount > 0) {
      ConsumptionRequest[]
        memory trimmedRegularRequests = new ConsumptionRequest[](regularCount);
      for (uint256 i = 0; i < regularCount; i++) {
        trimmedRegularRequests[i] = regularRequests[i];
      }
      _processConsumptionRequests(trimmedRegularRequests);
    }

    // Process export requests last
    if (exportCount > 0) {
      ConsumptionRequest[]
        memory trimmedExportRequests = new ConsumptionRequest[](exportCount);
      for (uint256 i = 0; i < exportCount; i++) {
        trimmedExportRequests[i] = exportRequests[i];
      }
      _processExportRequests(trimmedExportRequests);
    }
  }

  function _processConsumptionRequests(
    ConsumptionRequest[] memory requests
  ) internal {
    // Initialize/clear batch details for all known members
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      delete batchDetails[memberAddresses[i]];
    }

    // Phase 0: Aggregate total requested consumption per member for this batch
    for (uint256 i = 0; i < requests.length; i++) {
      address memberAddr = deviceToMember[requests[i].deviceId];
      require(memberAddr != address(0), 'Device not registered to any member');
      require(members[memberAddr].isActive, 'Member is not active');
      batchDetails[memberAddr].totalRequested += requests[i].quantity;
    }

    // Phase 1: Account for all self-consumption (adjust collectiveConsumption quantities)
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      address memberAddr = memberAddresses[i];
      if (batchDetails[memberAddr].totalRequested > 0) {
        uint256 allocated = allocatedTokens[memberAddr];
        uint256 canSelfConsume = batchDetails[memberAddr].totalRequested >
          allocated
          ? allocated
          : batchDetails[memberAddr].totalRequested;

        batchDetails[memberAddr].selfConsumed = canSelfConsume;
        if (batchDetails[memberAddr].totalRequested > allocated) {
          batchDetails[memberAddr].toBuy =
            batchDetails[memberAddr].totalRequested -
            allocated;
        }

        uint256 remainingToBurnFromOwn = canSelfConsume;
        for (
          uint256 j = 0;
          j < collectiveConsumption.length && remainingToBurnFromOwn > 0;
          j++
        ) {
          if (
            collectiveConsumption[j].owner == memberAddr &&
            collectiveConsumption[j].quantity > 0
          ) {
            uint256 burnAmount = remainingToBurnFromOwn >
              collectiveConsumption[j].quantity
              ? collectiveConsumption[j].quantity
              : remainingToBurnFromOwn;
            collectiveConsumption[j].quantity -= burnAmount;
            remainingToBurnFromOwn -= burnAmount;
          }
        }
      }
    }

    // Phase 2: Process over-consumption purchases (update cash balances)
    // Iterate through members who need to buy
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      address memberAddr = memberAddresses[i];
      if (batchDetails[memberAddr].toBuy > 0) {
        uint256 needsToBuy = batchDetails[memberAddr].toBuy;
        int256 costForThisOverConsumer = 0;
        uint256 tokensActuallyBought = 0;

        for (
          uint256 j = 0;
          j < collectiveConsumption.length && tokensActuallyBought < needsToBuy;
          j++
        ) {
          if (collectiveConsumption[j].quantity > 0) {
            uint256 canBuyFromSlot = needsToBuy - tokensActuallyBought;
            uint256 buyAmount = canBuyFromSlot >
              collectiveConsumption[j].quantity
              ? collectiveConsumption[j].quantity
              : canBuyFromSlot;

            int256 cost = int256(buyAmount * collectiveConsumption[j].price);
            costForThisOverConsumer += cost;

            cashCreditBalances[collectiveConsumption[j].owner] += cost; // Pay the owner
            batchDetails[collectiveConsumption[j].owner]
              .cashCreditChange += cost;

            collectiveConsumption[j].quantity -= buyAmount;
            tokensActuallyBought += buyAmount;
          }
        }
        cashCreditBalances[memberAddr] -= costForThisOverConsumer; // Debit the over-consumer
        batchDetails[memberAddr].cashCreditChange -= costForThisOverConsumer;
      }
    }

    // Phase 3: Emit EnergyConsumed events
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      address memberAddr = memberAddresses[i];
      if (batchDetails[memberAddr].totalRequested > 0) {
        emit EnergyConsumed(
          memberAddr,
          batchDetails[memberAddr].totalRequested,
          batchDetails[memberAddr].cashCreditChange
        );
      }
      // Reset for next potential call within same block (if allowed, though unlikely for this design)
      delete batchDetails[memberAddr];
    }
  }

  function _processExportRequests(
    ConsumptionRequest[] memory exportRequests
  ) internal {
    // Calculate total remaining tokens and their value for export
    int256 totalExportRevenue = 0;
    uint256 totalExportedTokens = 0;
    uint256 totalExportRequested = 0;

    // Sum up all export requests
    for (uint256 i = 0; i < exportRequests.length; i++) {
      totalExportRequested += exportRequests[i].quantity;
    }

    // Export remaining tokens up to the requested amount
    for (
      uint256 i = 0;
      i < collectiveConsumption.length &&
        totalExportedTokens < totalExportRequested;
      i++
    ) {
      if (collectiveConsumption[i].quantity > 0) {
        uint256 canExport = totalExportRequested - totalExportedTokens;
        uint256 exportAmount = canExport > collectiveConsumption[i].quantity
          ? collectiveConsumption[i].quantity
          : canExport;

        int256 tokenValue = int256(
          exportAmount * collectiveConsumption[i].price
        );

        // Pay the token owner for their exported tokens
        cashCreditBalances[collectiveConsumption[i].owner] += tokenValue;

        // Track export revenue
        totalExportRevenue += tokenValue;
        totalExportedTokens += exportAmount;

        // Remove the exported tokens
        collectiveConsumption[i].quantity -= exportAmount;
      }
    }

    // Record total export cost
    exportCashCreditBalance = -totalExportRevenue;

    // Emit detailed export event
    if (totalExportedTokens > 0) {
      emit EnergyExported(totalExportedTokens, totalExportRevenue);
    }
  }

  function _sortCollectiveConsumptionByPrice() internal {
    uint256 n = collectiveConsumption.length;
    for (uint256 i = 0; i < n - 1; i++) {
      for (uint256 j = 0; j < n - i - 1; j++) {
        if (
          collectiveConsumption[j].price > collectiveConsumption[j + 1].price
        ) {
          CollectiveConsumption memory temp = collectiveConsumption[j];
          collectiveConsumption[j] = collectiveConsumption[j + 1];
          collectiveConsumption[j + 1] = temp;
        }
      }
    }
  }

  // View functions
  function getCashCreditBalance(
    address member
  ) external view override returns (int256) {
    return cashCreditBalances[member];
  }

  function getCollectiveConsumption()
    external
    view
    override
    returns (CollectiveConsumption[] memory)
  {
    return collectiveConsumption;
  }

  function getMember(
    address memberAddress
  ) external view override returns (Member memory) {
    require(members[memberAddress].isActive, 'Member does not exist');
    return members[memberAddress];
  }

  function getAllocatedTokens(
    address member
  ) external view override returns (uint256) {
    return allocatedTokens[member];
  }

  function getTotalOwnershipPercentage()
    external
    view
    override
    returns (uint256)
  {
    return totalOwnershipPercentage;
  }

  function getDeviceOwner(
    uint256 deviceId
  ) external view override returns (address) {
    return deviceToMember[deviceId];
  }

  function getExportCashCreditBalance()
    external
    view
    override
    returns (int256)
  {
    return exportCashCreditBalance;
  }

  function getBatteryInfo()
    external
    view
    override
    returns (BatteryInfo memory)
  {
    return
      BatteryInfo({
        currentState: batteryCurrentState,
        price: batteryPrice,
        maxCapacity: batteryMaxCapacity,
        configured: batteryConfigured
      });
  }

  function getExportDeviceId() external view override returns (uint256) {
    return exportDeviceId;
  }
}
