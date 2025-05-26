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
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

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
    EnergySource[] calldata sources
  ) external override onlyOwner {
    require(sources.length > 0, 'No sources provided');
    require(totalOwnershipPercentage == 10000, 'Total ownership must be 100%');

    // Clear previous distribution
    delete collectiveConsumption;
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      allocatedTokens[memberAddresses[i]] = 0;
    }

    uint256 totalQuantity = 0;

    // Process each source
    for (uint256 i = 0; i < sources.length; i++) {
      EnergySource memory source = sources[i];
      totalQuantity += source.quantity;

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

    emit EnergyDistributed(sources.length, totalQuantity);
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
        // If not all needed tokens could be bought (should not happen if system is balanced before export)
        // For simplicity, we assume all 'needsToBuy' are met or system relies on export for final balance.
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

    // Phase 4: Process export
    _processExport();
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

  function _processExport() internal {
    // Calculate total remaining tokens and their value
    int256 totalExportRevenue = 0;
    uint256 totalExportedTokens = 0;
    bool tokensToExport = false;

    // Check if there are any tokens left to export
    for (uint256 i = 0; i < collectiveConsumption.length; i++) {
      if (collectiveConsumption[i].quantity > 0) {
        tokensToExport = true;
        break;
      }
    }

    // Only proceed if there are tokens to export
    if (tokensToExport) {
      // Export all remaining tokens and calculate revenue
      for (uint256 i = 0; i < collectiveConsumption.length; i++) {
        if (collectiveConsumption[i].quantity > 0) {
          int256 tokenValue = int256(
            collectiveConsumption[i].quantity * collectiveConsumption[i].price
          );

          // Pay the token owner for their exported tokens
          cashCreditBalances[collectiveConsumption[i].owner] += tokenValue;
          // Note: batchDetails is not used here as it's for intra-batch debits/credits

          // Track export cost
          totalExportRevenue += tokenValue;
          totalExportedTokens += collectiveConsumption[i].quantity;

          // Clear the exported tokens
          collectiveConsumption[i].quantity = 0;
        }
      }

      // Record total export cost
      exportCashCreditBalance = -totalExportRevenue;

      // Emit detailed export event
      emit EnergyExported(totalExportedTokens, totalExportRevenue);
    } else {
      // If no tokens to export, ensure export balance is zero
      exportCashCreditBalance = 0;
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
}
