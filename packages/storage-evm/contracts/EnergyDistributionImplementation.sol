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
    importCashCreditBalance = 0;
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
        quantity: uint256(-batteryEnergyChange),
        isImport: false
      });
      adjustedSourcesCount++;
      totalQuantity += uint256(-batteryEnergyChange);
    }

    // Distribute energy tokens from all sources
    for (uint256 i = 0; i < adjustedSourcesCount; i++) {
      EnergySource memory source = adjustedSources[i];

      if (source.isImport) {
        // IMPORTS: Add to community pool, track cost separately
        _handleImportSource(source);
      } else {
        // LOCAL PRODUCTION: Distribute by ownership percentage
        _handleOwnedSource(source);
      }
    }

    // Sort collective consumption by price (ascending)
    _sortCollectiveConsumptionByPrice();

    emit EnergyDistributed(adjustedSourcesCount, totalQuantity);
    emit CollectiveConsumptionUpdated(collectiveConsumption.length);
  }

  function consumeEnergyTokens(
    ConsumptionRequest[] calldata consumptionRequests
  ) external override onlyOwner {
    require(consumptionRequests.length > 0, 'No consumption requests provided');

    // Sort collective consumption by price (cheapest first)
    _sortCollectiveConsumptionByPrice();

    // Separate export and consumption requests
    ConsumptionRequest[] memory exportRequests = new ConsumptionRequest[](
      consumptionRequests.length
    );
    ConsumptionRequest[] memory memberRequests = new ConsumptionRequest[](
      consumptionRequests.length
    );

    uint256 exportCount = 0;
    uint256 memberCount = 0;

    for (uint256 i = 0; i < consumptionRequests.length; i++) {
      if (consumptionRequests[i].deviceId == exportDeviceId) {
        exportRequests[exportCount] = consumptionRequests[i];
        exportCount++;
      } else {
        memberRequests[memberCount] = consumptionRequests[i];
        memberCount++;
      }
    }

    // Process member consumption requests (buy from collective pool)
    if (memberCount > 0) {
      _processMemberConsumption(memberRequests, memberCount);
    }

    // Process export requests (sell leftover tokens)
    if (exportCount > 0) {
      _processExportRequests(exportRequests);
    }

    emit CollectiveConsumptionUpdated(collectiveConsumption.length);
  }

  function _processMemberConsumption(
    ConsumptionRequest[] memory memberRequests,
    uint256 requestCount
  ) internal {
    for (uint256 i = 0; i < requestCount; i++) {
      ConsumptionRequest memory request = memberRequests[i];
      address memberAddress = deviceToMember[request.deviceId];

      require(memberAddress != address(0), 'Device owner not found');
      require(members[memberAddress].isActive, 'Member is not active');

      uint256 remainingToConsume = request.quantity;
      int256 totalCost = 0;

      // Buy tokens from collective pool (cheapest first)
      for (
        uint256 j = 0;
        j < collectiveConsumption.length && remainingToConsume > 0;
        j++
      ) {
        if (collectiveConsumption[j].quantity > 0) {
          uint256 canConsume = remainingToConsume >
            collectiveConsumption[j].quantity
            ? collectiveConsumption[j].quantity
            : remainingToConsume;

          int256 cost = int256(canConsume * collectiveConsumption[j].price);
          totalCost += cost;

          // Pay the token owner (even if it's the consumer themselves)
          if (collectiveConsumption[j].owner != address(0)) {
            // Member-owned tokens - pay the member
            cashCreditBalances[collectiveConsumption[j].owner] += cost;
          }
          // Note: For community-owned tokens (imports), no payment to owner

          collectiveConsumption[j].quantity -= canConsume;
          remainingToConsume -= canConsume;
        }
      }

      require(remainingToConsume == 0, 'Insufficient energy tokens available');

      // Member pays for consumed tokens
      cashCreditBalances[memberAddress] -= totalCost;

      emit EnergyConsumed(memberAddress, request.quantity, totalCost);
    }
  }

  function _processExportRequests(
    ConsumptionRequest[] memory exportRequests
  ) internal {
    uint256 totalExportedTokens = 0;
    uint256 totalExportRequested = 0;
    int256 totalCalculatedExportRevenue = 0;

    for (uint256 i = 0; i < exportRequests.length; i++) {
      totalExportRequested += exportRequests[i].quantity;
    }

    for (
      uint256 j = 0;
      j < collectiveConsumption.length &&
        totalExportedTokens < totalExportRequested;
      j++
    ) {
      if (collectiveConsumption[j].quantity > 0) {
        uint256 canExport = totalExportRequested - totalExportedTokens;
        uint256 exportAmount = canExport > collectiveConsumption[j].quantity
          ? collectiveConsumption[j].quantity
          : canExport;

        int256 tokenValue = int256(
          exportAmount * collectiveConsumption[j].price
        );

        totalCalculatedExportRevenue += tokenValue;

        // Pay the token owner when their tokens are exported
        if (collectiveConsumption[j].owner != address(0)) {
          cashCreditBalances[collectiveConsumption[j].owner] += tokenValue;
        }

        totalExportedTokens += exportAmount;
        collectiveConsumption[j].quantity -= exportAmount;
      }
    }

    if (totalCalculatedExportRevenue > 0) {
      // Grid owes community for exported energy
      exportCashCreditBalance -= totalCalculatedExportRevenue;

      // NO ADDITIONAL DISTRIBUTION - token owners already got paid above
    }

    if (totalExportedTokens > 0) {
      emit EnergyExported(totalExportedTokens, totalCalculatedExportRevenue);
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

  function getImportCashCreditBalance()
    external
    view
    override
    returns (int256)
  {
    return importCashCreditBalance;
  }

  function _handleOwnedSource(EnergySource memory source) internal {
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

        // Add to collective consumption list owned by member
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

  function _handleImportSource(EnergySource memory source) internal {
    // Track total import cost as debt that needs to be paid by consumers
    int256 importCost = int256(source.quantity * source.price);
    importCashCreditBalance += importCost; // This correctly stores import cost as a positive value

    // Add imported energy to community pool (owned by address(0))
    // Over-consumers will buy from this pool at cost price
    collectiveConsumption.push(
      CollectiveConsumption({
        owner: address(0), // Community-owned import pool
        price: source.price,
        quantity: source.quantity
      })
    );

    emit EnergyImported(source.quantity, importCost);
  }
}
