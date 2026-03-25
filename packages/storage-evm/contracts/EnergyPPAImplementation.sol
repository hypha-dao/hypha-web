// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './storage/EnergyPPAStorage.sol';
import './interfaces/IEnergyPPA.sol';

/// @title  EnergyPPAImplementation
/// @notice Single-function energy settlement for a community.
///
///         consumeEnergy() does everything:
///         1. Each reading charges the consumer (qty × price)
///         2. LOCAL charges + export revenue go into a revenue pot
///         3. IMPORT charges go to the import balance
///         4. Revenue pot is split: community fee % → aggregator fee % → rest to owners
contract EnergyPPAImplementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  ReentrancyGuardUpgradeable,
  EnergyPPAStorage,
  IEnergyPPA
{
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

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  modifier onlyWhitelist() {
    require(isWhitelisted[msg.sender], 'Caller is not whitelisted');
    _;
  }

  modifier ensureZeroSum() {
    _;
    (bool ok, ) = _verifyZeroSum();
    require(ok, 'Zero-sum violation');
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Core: consumeEnergy
  // ══════════════════════════════════════════════════════════════════════

  function consumeEnergy(
    ConsumptionReading[] calldata readings
  ) external override onlyWhitelist ensureZeroSum {
    require(readings.length > 0, 'No readings');

    uint256 totalLocalRevenue = 0;

    // ── Step 1: Process each reading — charge consumers ──────────────
    for (uint256 i = 0; i < readings.length; i++) {
      if (readings[i].deviceId == exportDeviceId) {
        require(exportPrice > 0, 'Export price not set');
        uint256 revenue = readings[i].quantity * exportPrice;
        totalLocalRevenue += revenue;
        exportCashCreditBalance -= int256(revenue);
        emit EnergyExported(readings[i].quantity, revenue);
        continue;
      }

      address addr = deviceToMember[readings[i].deviceId];
      require(addr != address(0), 'Device not found');
      require(members[addr].isActive, 'Member not active');

      uint256 charge = readings[i].quantity * readings[i].pricePerKwh;
      _adjustCashCreditBalance(addr, -int256(charge));

      if (readings[i].source == Source.LOCAL) {
        totalLocalRevenue += charge;
      } else {
        importCashCreditBalance += int256(charge);
      }

      emit EnergyConsumed(
        addr,
        readings[i].quantity,
        readings[i].pricePerKwh,
        readings[i].source
      );
    }

    // ── Step 2: Split local revenue ──────────────────────────────────
    if (totalLocalRevenue > 0) {
      uint256 remaining = totalLocalRevenue;

      // Community fee
      if (communityFeeBps > 0 && communityAddress != address(0)) {
        uint256 fee = (totalLocalRevenue * communityFeeBps) / 10000;
        _adjustCashCreditBalance(communityAddress, int256(fee));
        remaining -= fee;
        emit CommunityFeeCollected(communityAddress, fee);
      }

      // Aggregator fee
      if (aggregatorFeeBps > 0 && aggregatorAddress != address(0)) {
        uint256 fee = (totalLocalRevenue * aggregatorFeeBps) / 10000;
        _adjustCashCreditBalance(aggregatorAddress, int256(fee));
        remaining -= fee;
        emit AggregatorFeeCollected(aggregatorAddress, fee);
      }

      // Owner distribution
      if (remaining > 0) {
        uint256 distributed = 0;
        uint256 lastIdx = memberAddresses.length - 1;

        for (uint256 i = 0; i < memberAddresses.length; i++) {
          address addr = memberAddresses[i];
          uint256 share;

          if (i == lastIdx) {
            share = remaining - distributed;
          } else {
            share = (remaining * members[addr].ownershipBps) / 10000;
          }
          distributed += share;

          if (share > 0) {
            _adjustCashCreditBalance(addr, int256(share));
            emit RevenueDistributed(addr, share, totalLocalRevenue);
          }
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  Members
  // ══════════════════════════════════════════════════════════════════════

  function addMember(
    address memberAddress,
    uint256[] calldata deviceIds,
    uint256 ownershipBps,
    bytes32 metadataHash
  ) external override onlyWhitelist {
    require(memberAddress != address(0), 'Invalid address');
    require(deviceIds.length > 0, 'No device IDs');
    require(!members[memberAddress].isActive, 'Member exists');
    require(
      totalOwnershipBps + ownershipBps <= 10000,
      'Total ownership exceeds 100%'
    );

    for (uint256 i = 0; i < deviceIds.length; i++) {
      require(
        deviceToMember[deviceIds[i]] == address(0),
        'Device already assigned'
      );
    }

    members[memberAddress] = MemberPPA({
      memberAddress: memberAddress,
      deviceIds: deviceIds,
      ownershipBps: ownershipBps,
      isActive: true,
      metadataHash: metadataHash
    });

    memberAddresses.push(memberAddress);
    totalOwnershipBps += ownershipBps;

    for (uint256 i = 0; i < deviceIds.length; i++) {
      deviceToMember[deviceIds[i]] = memberAddress;
    }

    emit MemberAdded(memberAddress, ownershipBps);
  }

  function removeMember(
    address memberAddress
  ) external override onlyWhitelist {
    require(members[memberAddress].isActive, 'Member does not exist');
    MemberPPA memory m = members[memberAddress];

    for (uint256 i = 0; i < m.deviceIds.length; i++) {
      delete deviceToMember[m.deviceIds[i]];
    }
    totalOwnershipBps -= m.ownershipBps;

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

  // ══════════════════════════════════════════════════════════════════════
  //  Stablecoin Settlement
  // ══════════════════════════════════════════════════════════════════════

  function settleDebt(
    address debtor,
    uint256 stablecoinAmount
  ) external override nonReentrant {
    _settle(debtor, stablecoinAmount);
  }

  function settleOwnDebt(
    uint256 stablecoinAmount
  ) external override nonReentrant {
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

  // ══════════════════════════════════════════════════════════════════════
  //  Admin
  // ══════════════════════════════════════════════════════════════════════

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
    require(tokenAddress != address(0), 'Invalid address');
    energyToken = EnergyToken(tokenAddress);
  }

  function setStablecoin(
    address tokenAddress
  ) external override onlyWhitelist {
    stablecoinAddress = tokenAddress;
  }

  function setExportDeviceId(
    uint256 deviceId
  ) external override onlyWhitelist {
    exportDeviceId = deviceId;
    emit ExportDeviceIdSet(deviceId);
  }

  function setExportPrice(uint256 price) external override onlyWhitelist {
    require(price > 0, 'Invalid price');
    exportPrice = price;
    emit ExportPriceSet(price);
  }

  function setCommunityAddress(address addr) external override onlyOwner {
    communityAddress = addr;
  }

  function setAggregatorAddress(address addr) external override onlyOwner {
    aggregatorAddress = addr;
  }

  function setCommunityFeeBps(uint16 bps) external override onlyOwner {
    require(bps + aggregatorFeeBps <= 10000, 'Total fees exceed 100%');
    communityFeeBps = bps;
  }

  function setAggregatorFeeBps(uint16 bps) external override onlyOwner {
    require(communityFeeBps + bps <= 10000, 'Total fees exceed 100%');
    aggregatorFeeBps = bps;
  }

  function setPaymentRecipient(
    address recipient
  ) external override onlyOwner {
    paymentRecipient = recipient;
  }

  function emergencyReset() external override onlyWhitelist {
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

  // ══════════════════════════════════════════════════════════════════════
  //  Internal
  // ══════════════════════════════════════════════════════════════════════

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

  // ══════════════════════════════════════════════════════════════════════
  //  Views
  // ══════════════════════════════════════════════════════════════════════

  function getMember(
    address memberAddress
  ) external view override returns (MemberPPA memory) {
    require(members[memberAddress].isActive, 'Member does not exist');
    return members[memberAddress];
  }

  function getCashCreditBalance(
    address account
  ) external view override returns (int256) {
    return _getCashCreditBalance(account);
  }

  function getTokenBalance(
    address account
  ) external view override returns (uint256) {
    return energyToken.balanceOf(account);
  }

  function getDebtInStablecoin(
    address debtor
  ) external view override returns (uint256) {
    int256 bal = _getCashCreditBalance(debtor);
    if (bal >= 0) return 0;
    return uint256(-bal) * 10000;
  }

  function verifyZeroSum()
    external
    view
    override
    returns (bool, int256)
  {
    return _verifyZeroSum();
  }

  function getTotalOwnershipBps()
    external
    view
    override
    returns (uint256)
  {
    return totalOwnershipBps;
  }

  function getDeviceOwner(
    uint256 deviceId
  ) external view override returns (address) {
    return deviceToMember[deviceId];
  }

  function getImportCashCreditBalance()
    external
    view
    override
    returns (int256)
  {
    return importCashCreditBalance;
  }

  function getExportCashCreditBalance()
    external
    view
    override
    returns (int256)
  {
    return exportCashCreditBalance;
  }

  function getSettledBalance()
    external
    view
    override
    returns (int256)
  {
    return settledBalance;
  }

  function getExportPrice() external view override returns (uint256) {
    return exportPrice;
  }

  function getEnergyTokenAddress()
    external
    view
    override
    returns (address)
  {
    return address(energyToken);
  }

  function isAddressWhitelisted(
    address account
  ) external view override returns (bool) {
    return isWhitelisted[account];
  }

  function getCommunityFeeBps() external view override returns (uint16) {
    return communityFeeBps;
  }

  function getAggregatorFeeBps() external view override returns (uint16) {
    return aggregatorFeeBps;
  }
}
