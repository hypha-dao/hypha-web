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

  function initialize(
    address initialOwner,
    address energyTokenAddress
  ) public initializer {
    __Ownable_init(initialOwner);
    __UUPSUpgradeable_init();

    energyToken = EnergyToken(energyTokenAddress);
    totalOwnershipPercentage = 0;
    batteryCurrentState = 0;
    batteryConfigured = false;
    exportDeviceId = 0;
    communityDeviceId = 0;
    importCashCreditBalance = 0;
    communityCashCreditBalance = 0;
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  modifier onlyWhitelist() {
    require(isWhitelisted[msg.sender], 'Caller is not whitelisted');
    _;
  }

  function updateWhitelist(
    address account,
    bool _isWhitelisted
  ) external override onlyOwner {
    require(account != address(0), 'Invalid address');
    isWhitelisted[account] = _isWhitelisted;
    emit WhitelistUpdated(account, _isWhitelisted);
  }

  function setEnergyToken(
    address tokenAddress
  ) external override onlyWhitelist {
    require(tokenAddress != address(0), 'Invalid token address');
    energyToken = EnergyToken(tokenAddress);
  }

  function configureBattery(
    uint256 price,
    uint256 maxCapacity
  ) external override onlyWhitelist {
    require(price > 0, 'Battery price must be greater than 0');
    require(maxCapacity > 0, 'Battery max capacity must be greater than 0');

    batteryPrice = price;
    batteryMaxCapacity = maxCapacity;
    batteryConfigured = true;

    emit BatteryConfigured(price, maxCapacity);
  }

  function setExportDeviceId(uint256 deviceId) external override onlyWhitelist {
    exportDeviceId = deviceId;
    emit ExportDeviceIdSet(deviceId);
  }

  function setCommunityDeviceId(
    uint256 deviceId
  ) external override onlyWhitelist {
    communityDeviceId = deviceId;
    emit CommunityDeviceIdSet(deviceId);
  }

  function setExportPrice(uint256 price) external onlyWhitelist {
    require(price > 0, 'Export price must be greater than 0');
    exportPrice = price;
    emit ExportPriceSet(price);
  }

  function setSettlementContract(
    address _settlementContract
  ) external override onlyWhitelist {
    require(
      _settlementContract != address(0),
      'Invalid settlement contract address'
    );

    address oldContract = settlementContract;
    settlementContract = _settlementContract;

    emit SettlementContractUpdated(oldContract, _settlementContract);
  }

  function settleDebt(address debtor, int256 amount) external override {
    require(
      msg.sender == settlementContract,
      'Only settlement contract can settle debt'
    );
    require(debtor != address(0), 'Invalid debtor address');
    require(amount > 0, 'Settlement amount must be positive');

    // Get current balance
    int256 previousBalance = _getCashCreditBalance(debtor);

    // Only allow settlement if balance is negative (debt exists)
    require(previousBalance < 0, 'No debt to settle');

    // Calculate new balance after settlement
    int256 newBalance = previousBalance + amount;

    // If settlement amount exceeds debt, only settle up to the debt amount
    if (newBalance > 0) {
      newBalance = 0;
      amount = -previousBalance; // Adjust amount to exactly clear the debt
    }

    // Update the balance
    _setCashCreditBalance(debtor, newBalance);

    // To maintain zero-sum property, the settled amount comes from outside the system
    // We track this in a separate settled balance (external money brought into system)
    // This represents external money coming into the system to pay off debt
    settledBalance -= amount;

    // Emit settlement event
    emit DebtSettled(debtor, amount, previousBalance, newBalance);
  }

  function addMember(
    address memberAddress,
    uint256[] calldata deviceIds,
    uint256 ownershipPercentage
  ) external override onlyWhitelist {
    require(memberAddress != address(0), 'Invalid member address');
    require(deviceIds.length > 0, 'No device IDs provided');
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

  function removeMember(address memberAddress) external override onlyWhitelist {
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

    // Burn any remaining tokens
    uint256 tokenBalance = energyToken.balanceOf(memberAddress);
    if (tokenBalance > 0) {
      energyToken.burn(memberAddress, tokenBalance);
    }

    emit MemberRemoved(memberAddress);
  }

  function distributeEnergyTokens(
    EnergySource[] calldata sources,
    uint256 batteryState
  ) external override onlyWhitelist ensureZeroSum {
    require(sources.length > 0, 'No sources provided');
    require(totalOwnershipPercentage == 10000, 'Total ownership must be 100%');

    // FIX 1: Prevent distribution if energy remains unconsumed
    require(
      _getTotalAvailableEnergy() == 0,
      'Previous energy distribution must be fully consumed before new distribution'
    );

    // Clear previous distribution by popping each element
    while (collectiveConsumption.length > 0) {
      collectiveConsumption.pop();
    }
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      allocatedTokens[memberAddresses[i]] = 0;
    }

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
          'Inuf local prodion for battery chargng'
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
  ) external override onlyWhitelist ensureZeroSum {
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

    // Process export requests FIRST (prioritize exports)
    if (exportCount > 0) {
      _processExportRequests(exportRequests, exportCount);
    }

    // Process member consumption requests (buy from remaining collective pool)
    if (memberCount > 0) {
      _processMemberConsumption(memberRequests, memberCount);
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

      // FIRST PASS: Prioritize self-consumption (own tokens first)
      for (
        uint256 j = 0;
        j < collectiveConsumption.length && remainingToConsume > 0;
        j++
      ) {
        // Only consume own tokens in first pass
        if (
          collectiveConsumption[j].quantity > 0 &&
          collectiveConsumption[j].owner == memberAddress
        ) {
          uint256 canConsume = remainingToConsume >
            collectiveConsumption[j].quantity
            ? collectiveConsumption[j].quantity
            : remainingToConsume;

          int256 cost = int256(canConsume * collectiveConsumption[j].price);
          totalCost += cost;

          // Self-consumption: credit payment to community address to maintain zero-sum
          // address communityAddress = deviceToMember[communityDeviceId];
          // require(communityAddress != address(0), 'Community address not set');
          // _adjustCashCreditBalance(communityAddress, cost);
          _adjustCommunityBalance(cost);

          collectiveConsumption[j].quantity -= canConsume;
          remainingToConsume -= canConsume;
        }
      }

      // SECOND PASS: Buy from others if still needed (other members' tokens or imports)
      for (
        uint256 j = 0;
        j < collectiveConsumption.length && remainingToConsume > 0;
        j++
      ) {
        // Skip own tokens (already consumed in first pass) and empty slots
        if (
          collectiveConsumption[j].quantity > 0 &&
          collectiveConsumption[j].owner != memberAddress
        ) {
          uint256 canConsume = remainingToConsume >
            collectiveConsumption[j].quantity
            ? collectiveConsumption[j].quantity
            : remainingToConsume;

          int256 cost = int256(canConsume * collectiveConsumption[j].price);
          totalCost += cost;

          // Pay the token owner
          if (collectiveConsumption[j].owner != address(0)) {
            // Different member owns the token - pay them
            _adjustCashCreditBalance(collectiveConsumption[j].owner, cost);
          } else {
            // Community-owned tokens (imports): member payment goes to import cash balance
            // This maintains zero-sum accounting: member pays, import balance receives
            importCashCreditBalance += cost;
          }

          collectiveConsumption[j].quantity -= canConsume;
          remainingToConsume -= canConsume;
        }
      }

      require(remainingToConsume == 0, 'Insufficient energy tokens available');

      // Member pays for consumed tokens
      _adjustCashCreditBalance(memberAddress, -totalCost);

      emit EnergyConsumed(memberAddress, request.quantity, totalCost);
    }
  }

  function _processExportRequests(
    ConsumptionRequest[] memory exportRequests,
    uint256 requestCount
  ) internal {
    require(
      exportPrice > 0,
      'Export price must be configured before exporting'
    );

    uint256 totalExportedTokens = 0;
    uint256 totalExportRequested = 0;
    int256 totalCalculatedExportRevenue = 0;

    for (uint256 i = 0; i < requestCount; i++) {
      totalExportRequested += exportRequests[i].quantity;
    }

    for (
      uint256 j = 0;
      j < collectiveConsumption.length &&
        totalExportedTokens < totalExportRequested;
      j++
    ) {
      if (
        collectiveConsumption[j].quantity > 0 &&
        collectiveConsumption[j].owner != address(0)
      ) {
        uint256 remainingToExport = totalExportRequested - totalExportedTokens;
        uint256 amountToProcess = 0;

        if (collectiveConsumption[j].quantity >= remainingToExport) {
          amountToProcess = remainingToExport;
        } else {
          amountToProcess = collectiveConsumption[j].quantity;
        }

        if (amountToProcess > 0) {
          int256 revenue = int256(amountToProcess * exportPrice);
          int256 cost = int256(
            amountToProcess * collectiveConsumption[j].price
          );
          int256 profit = revenue - cost;

          // Atomically credit member with profit, community with cost, and debit export balance
          if (profit != 0) {
            _adjustCashCreditBalance(collectiveConsumption[j].owner, profit);
          }
          _adjustCommunityBalance(cost);
          exportCashCreditBalance -= revenue;

          totalCalculatedExportRevenue += revenue; // Still track for event emitting

          totalExportedTokens += amountToProcess;
          collectiveConsumption[j].quantity -= amountToProcess;
        }
      }
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

  // FIX 1: Helper function to calculate total available energy in collective pool
  function _getTotalAvailableEnergy() internal view returns (uint256) {
    uint256 total = 0;
    for (uint256 i = 0; i < collectiveConsumption.length; i++) {
      total += collectiveConsumption[i].quantity;
    }
    return total;
  }

  // FIX 3: Zero-sum verification functions
  function verifyZeroSumProperty() public view returns (bool, int256) {
    int256 totalMemberBalances = 0;

    // Sum all member balances (using token-aware helper function)
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      totalMemberBalances += _getCashCreditBalance(memberAddresses[i]);
    }

    // Calculate total system balance (should be zero)
    int256 totalSystemBalance = totalMemberBalances +
      exportCashCreditBalance +
      importCashCreditBalance +
      settledBalance +
      communityCashCreditBalance;

    return (totalSystemBalance == 0, totalSystemBalance);
  }

  // FIX 3: Modifier to ensure zero-sum property is maintained
  modifier ensureZeroSum() {
    _;
    (bool isZeroSum, int256 balance) = verifyZeroSumProperty();
    require(
      isZeroSum,
      string(abi.encodePacked('Zero-sum violation: ', _int256ToString(balance)))
    );
  }

  // FIX 5: Emergency reset function
  function emergencyReset() external onlyWhitelist {
    address treasury = 0xD86e25d230D1dB17BC573399FB7f14c8d8c685Ae;

    // Clear all collective consumption by popping each element
    while (collectiveConsumption.length > 0) {
      collectiveConsumption.pop();
    }

    // Reset all allocated tokens
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      allocatedTokens[memberAddresses[i]] = 0;
    }

    // Reset all member cash balances to zero
    for (uint256 i = 0; i < memberAddresses.length; i++) {
      _setCashCreditBalance(memberAddresses[i], 0);
    }

    // Reset community balance if it exists
    address communityAddress = deviceToMember[communityDeviceId];
    if (communityAddress != address(0)) {
      _setCashCreditBalance(communityAddress, 0);
    }

    // Burn tokens from treasury if community balance is positive
    if (communityCashCreditBalance > 0) {
      uint256 treasuryBalance = energyToken.balanceOf(treasury);
      if (treasuryBalance > 0) {
        energyToken.burn(treasury, treasuryBalance);
      }
    }

    // Reset system balances
    exportCashCreditBalance = 0;
    importCashCreditBalance = 0;
    settledBalance = 0;
    communityCashCreditBalance = 0;

    // Reset battery state
    batteryCurrentState = 0;

    emit EmergencyReset();
  }

  // Helper function to convert int256 to string
  function _int256ToString(int256 value) internal pure returns (string memory) {
    if (value == 0) {
      return '0';
    }

    bool negative = value < 0;
    if (negative) {
      value = -value;
    }

    uint256 temp = uint256(value);
    uint256 digits;
    while (temp != 0) {
      digits++;
      temp /= 10;
    }

    bytes memory buffer = new bytes(digits + (negative ? 1 : 0));
    uint256 index = digits;
    temp = uint256(value);

    while (temp != 0) {
      buffer[--index] = bytes1(uint8(48 + (temp % 10)));
      temp /= 10;
    }

    if (negative) {
      buffer[0] = '-';
    }

    return string(buffer);
  }

  // Helper functions for token/balance management
  function _getCashCreditBalance(
    address member
  ) internal view returns (int256) {
    uint256 tokenBalance = energyToken.balanceOf(member);
    int256 negativeBalance = cashCreditBalances[member];

    if (tokenBalance > 0) {
      return int256(tokenBalance);
    } else {
      return negativeBalance;
    }
  }

  function _setCashCreditBalance(address member, int256 amount) internal {
    uint256 currentTokenBalance = energyToken.balanceOf(member);

    // Clear current state
    if (currentTokenBalance > 0) {
      energyToken.burn(member, currentTokenBalance);
    }
    cashCreditBalances[member] = 0;

    // Set new state
    if (amount > 0) {
      energyToken.transfer(member, uint256(amount));
    } else if (amount < 0) {
      cashCreditBalances[member] = amount;
    }
  }

  // Helper function to update community balance with treasury integration
  function _adjustCommunityBalance(int256 adjustment) internal {
    address treasury = 0xD86e25d230D1dB17BC573399FB7f14c8d8c685Ae;
    int256 newBalance = communityCashCreditBalance + adjustment;

    // If balance goes from non-positive to positive, transfer tokens to treasury
    if (communityCashCreditBalance <= 0 && newBalance > 0) {
      // Transfer the positive amount to treasury
      energyToken.transfer(treasury, uint256(newBalance));
    } else if (
      communityCashCreditBalance > 0 && newBalance > communityCashCreditBalance
    ) {
      // Balance is already positive and increasing, transfer the additional amount
      uint256 additionalAmount = uint256(
        newBalance - communityCashCreditBalance
      );
      energyToken.transfer(treasury, additionalAmount);
    }

    communityCashCreditBalance = newBalance;
  }

  function _adjustCashCreditBalance(
    address member,
    int256 adjustment
  ) internal {
    int256 currentBalance = _getCashCreditBalance(member);
    int256 newBalance = currentBalance + adjustment;
    _setCashCreditBalance(member, newBalance);
  }

  // View functions
  function getCashCreditBalance(
    address member
  ) external view override returns (int256) {
    return _getCashCreditBalance(member);
  }

  function getTokenBalance(
    address member
  ) external view override returns (uint256) {
    return energyToken.balanceOf(member);
  }

  function getEnergyTokenAddress() external view override returns (address) {
    return address(energyToken);
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

  function getCommunityDeviceId() external view override returns (uint256) {
    return communityDeviceId;
  }

  function getCommunityCashCreditBalance() external view returns (int256) {
    return communityCashCreditBalance;
  }

  function getImportCashCreditBalance()
    external
    view
    override
    returns (int256)
  {
    return importCashCreditBalance;
  }

  function getExportPrice() external view returns (uint256) {
    return exportPrice;
  }

  function getSettlementContract() external view returns (address) {
    return settlementContract;
  }

  function getSettledBalance() external view returns (int256) {
    return settledBalance;
  }

  function isAddressWhitelisted(
    address account
  ) external view override returns (bool) {
    return isWhitelisted[account];
  }

  function _handleOwnedSource(EnergySource memory source) internal {
    uint256 totalDistributed = 0;
    uint256 lastMemberIndex = memberAddresses.length - 1;

    // Distribute to each member based on ownership percentage
    for (uint256 j = 0; j < memberAddresses.length; j++) {
      address memberAddr = memberAddresses[j];
      Member memory member = members[memberAddr];

      uint256 memberShare;

      if (j == lastMemberIndex) {
        memberShare = source.quantity - totalDistributed;
      } else {
        memberShare = (source.quantity * member.ownershipPercentage) / 10000;
      }
      totalDistributed += memberShare;

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
    // Import energy makes it available for consumption - no cash flow yet
    // importCashCreditBalance will increase when users actually pay for consumed imported energy

    // Add imported energy to community pool (owned by address(0))
    // Over-consumers will buy from this pool at cost price
    collectiveConsumption.push(
      CollectiveConsumption({
        owner: address(0), // Community-owned import pool
        price: source.price,
        quantity: source.quantity
      })
    );

    emit EnergyImported(
      source.quantity,
      int256(source.quantity * source.price)
    );
  }
}
