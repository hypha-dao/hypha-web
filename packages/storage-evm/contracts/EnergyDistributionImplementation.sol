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
      //cashCreditBalances[memberAddresses[i]] = 0;
    }

    uint256 totalQuantity = 0;

    // Process each source
    for (uint256 i = 0; i < sources.length; i++) {
      EnergySource memory source = sources[i];
      totalQuantity += source.quantity;

      // Distribute to each member based on ownership percentage
      for (uint256 j = 0; j < memberAddresses.length; j++) {
        address memberAddr = memberAddresses[j];
        Member memory member = members[memberAddr];

        uint256 memberShare = (source.quantity * member.ownershipPercentage) /
          10000;

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

  function consumeEnergyTokens(
    ConsumptionRequest[] calldata consumptionRequests
  ) external override onlyOwner {
    require(consumptionRequests.length > 0, 'No consumption requests provided');

    // Group consumption by member
    MemberConsumptionData[]
      memory memberConsumptionData = _groupConsumptionByMember(
        consumptionRequests
      );

    // Sort members by consumption pattern
    _sortMembersByConsumption(memberConsumptionData);

    // Process consumption for each member
    for (uint256 i = 0; i < memberConsumptionData.length; i++) {
      MemberConsumptionData memory data = memberConsumptionData[i];

      if (data.excess <= 0) {
        // Member consumed less than or equal to allocated
        _processUnderConsumption(
          data.memberAddress,
          data.consumed,
          data.allocated
        );
      } else {
        // Member consumed more than allocated
        _processOverConsumption(
          data.memberAddress,
          data.consumed,
          data.allocated
        );
      }

      emit EnergyConsumed(
        data.memberAddress,
        data.consumed,
        cashCreditBalances[data.memberAddress]
      );
    }
  }

  function _groupConsumptionByMember(
    ConsumptionRequest[] calldata consumptionRequests
  ) internal view returns (MemberConsumptionData[] memory) {
    // Create temporary mapping to accumulate consumption
    address[] memory uniqueMembers = new address[](memberAddresses.length);
    uint256[] memory memberConsumption = new uint256[](memberAddresses.length);
    uint256 uniqueCount = 0;

    // Process consumption requests
    for (uint256 i = 0; i < consumptionRequests.length; i++) {
      address memberAddr = deviceToMember[consumptionRequests[i].deviceId];
      require(memberAddr != address(0), 'Device not found');

      // Find or add member to unique list
      bool found = false;
      for (uint256 j = 0; j < uniqueCount; j++) {
        if (uniqueMembers[j] == memberAddr) {
          memberConsumption[j] += consumptionRequests[i].quantity;
          found = true;
          break;
        }
      }

      if (!found) {
        uniqueMembers[uniqueCount] = memberAddr;
        memberConsumption[uniqueCount] = consumptionRequests[i].quantity;
        uniqueCount++;
      }
    }

    // Create result array
    MemberConsumptionData[] memory result = new MemberConsumptionData[](
      uniqueCount
    );
    for (uint256 i = 0; i < uniqueCount; i++) {
      uint256 allocated = allocatedTokens[uniqueMembers[i]];
      uint256 consumed = memberConsumption[i];

      result[i] = MemberConsumptionData({
        memberAddress: uniqueMembers[i],
        consumed: consumed,
        allocated: allocated,
        excess: int256(consumed) - int256(allocated)
      });
    }

    return result;
  }

  function _sortMembersByConsumption(
    MemberConsumptionData[] memory memberData
  ) internal pure {
    uint256 length = memberData.length;

    // Bubble sort: under-consumers first, then over-consumers by excess amount
    for (uint256 i = 0; i < length - 1; i++) {
      for (uint256 j = 0; j < length - i - 1; j++) {
        bool shouldSwap = false;

        // Under-consumers should come first
        if (memberData[j].excess > 0 && memberData[j + 1].excess <= 0) {
          shouldSwap = true;
        }
        // Among over-consumers, sort by excess (least excess first)
        else if (memberData[j].excess > 0 && memberData[j + 1].excess > 0) {
          if (memberData[j].excess > memberData[j + 1].excess) {
            shouldSwap = true;
          }
        }

        if (shouldSwap) {
          MemberConsumptionData memory temp = memberData[j];
          memberData[j] = memberData[j + 1];
          memberData[j + 1] = temp;
        }
      }
    }
  }

  function _processUnderConsumption(
    address memberAddr,
    uint256 consumed,
    uint256 allocated
  ) internal {
    uint256 remainingToConsume = consumed;
    uint256 remainingUnused = allocated - consumed;
    int256 unusedValue = 0;

    // Calculate value of unused tokens and burn consumed tokens
    for (uint256 i = 0; i < collectiveConsumption.length; i++) {
      if (
        collectiveConsumption[i].owner == memberAddr &&
        collectiveConsumption[i].quantity > 0
      ) {
        uint256 availableTokens = collectiveConsumption[i].quantity;

        // First, burn tokens for consumption
        if (remainingToConsume > 0) {
          uint256 burnAmount = remainingToConsume > availableTokens
            ? availableTokens
            : remainingToConsume;
          collectiveConsumption[i].quantity -= burnAmount;
          remainingToConsume -= burnAmount;
          availableTokens -= burnAmount;
        }

        // Then, calculate value of remaining unused tokens
        if (remainingUnused > 0 && availableTokens > 0) {
          uint256 unusedAmount = remainingUnused > availableTokens
            ? availableTokens
            : remainingUnused;
          unusedValue += int256(unusedAmount * collectiveConsumption[i].price);
          remainingUnused -= unusedAmount;
        }
      }
    }

    // Positive balance: value of unused tokens
    cashCreditBalances[memberAddr] = unusedValue;
  }

  function _processOverConsumption(
    address memberAddr,
    uint256 consumed,
    uint256 allocated
  ) internal {
    uint256 remainingToConsume = consumed;
    int256 extraCost = 0;

    // First, burn all allocated tokens for this member (these are "free")
    for (
      uint256 i = 0;
      i < collectiveConsumption.length && remainingToConsume > 0;
      i++
    ) {
      if (
        collectiveConsumption[i].owner == memberAddr &&
        collectiveConsumption[i].quantity > 0
      ) {
        uint256 burnAmount = remainingToConsume >
          collectiveConsumption[i].quantity
          ? collectiveConsumption[i].quantity
          : remainingToConsume;

        collectiveConsumption[i].quantity -= burnAmount;
        remainingToConsume -= burnAmount;
      }
    }

    // Then calculate cost for additional consumption from collective pool
    for (
      uint256 i = 0;
      i < collectiveConsumption.length && remainingToConsume > 0;
      i++
    ) {
      if (collectiveConsumption[i].quantity > 0) {
        uint256 burnAmount = remainingToConsume >
          collectiveConsumption[i].quantity
          ? collectiveConsumption[i].quantity
          : remainingToConsume;

        extraCost += int256(burnAmount * collectiveConsumption[i].price);
        collectiveConsumption[i].quantity -= burnAmount;
        remainingToConsume -= burnAmount;
      }
    }

    // Negative balance: cost of extra consumption
    cashCreditBalances[memberAddr] = -extraCost;
  }

  function _sortCollectiveConsumptionByPrice() internal {
    uint256 length = collectiveConsumption.length;

    // Bubble sort by price (ascending)
    for (uint256 i = 0; i < length - 1; i++) {
      for (uint256 j = 0; j < length - i - 1; j++) {
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
}
