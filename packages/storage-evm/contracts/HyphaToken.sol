// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './storage/HyphaTokenStorage.sol';
import './interfaces/ISpacePaymentTracker.sol';
import './interfaces/IHyphaToken.sol';

contract HyphaToken is
  Initializable,
  ERC20Upgradeable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  HyphaTokenStorage,
  IHyphaToken
{
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address _usdc,
    address _paymentTracker
  ) public initializer {
    __ERC20_init('HYPHA', 'HYPHA');
    __Ownable_init(msg.sender);
    __UUPSUpgradeable_init();

    usdc = IERC20(_usdc);
    paymentTracker = ISpacePaymentTracker(_paymentTracker);
    lastUpdateTime = block.timestamp;
    totalMinted = 0;
    distributionMultiplier = 10; // Initial value

    // Set initial values for the modifiable parameters
    HYPHA_PRICE_USD = 25 * 10 ** 16; // 0.25 USD with 18 decimals
    USDC_PER_DAY = 367_000; // 0.367 USDC with 6 decimals
    HYPHA_PER_DAY = 1_466_666_666_666_666_666; // ~1.47 HYPHA with 18 decimals
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  /**
   * @dev Override transfer and transferFrom to make the token non-transferable
   */
  function transfer(
    address,
    uint256
  ) public virtual override(ERC20Upgradeable, IHyphaToken) returns (bool) {
    revert('HYPHA: Transfers disabled');
  }

  function transferFrom(
    address,
    address,
    uint256
  ) public virtual override(ERC20Upgradeable, IHyphaToken) returns (bool) {
    revert('HYPHA: Transfers disabled');
  }

  /**
   * @dev Set destination addresses for transfers
   * @param _iexAddress Address to receive USDC from payForSpaces and HYPHA from payInHypha
   * @param _mainHyphaAddress Address to receive USDC from investInHypha
   */
  function setDestinationAddresses(
    address _iexAddress,
    address _mainHyphaAddress
  ) external onlyOwner {
    require(_iexAddress != address(0), 'Invalid IEX address');
    require(_mainHyphaAddress != address(0), 'Invalid mainHypha address');

    iexAddress = _iexAddress;
    mainHyphaAddress = _mainHyphaAddress;

    emit DestinationAddressesUpdated(_iexAddress, _mainHyphaAddress);
  }

  /**
   * @dev Pay for multiple spaces with USDC and distribute HYPHA tokens to the rewards pool
   * @param spaceIds Array of space IDs to pay for
   * @param usdcAmounts Array of USDC amounts for each space
   */
  function payForSpaces(
    uint256[] calldata spaceIds,
    uint256[] calldata usdcAmounts
  ) external override {
    require(
      spaceIds.length == usdcAmounts.length,
      'Input arrays length mismatch'
    );
    require(spaceIds.length > 0, 'No spaces specified');
    require(iexAddress != address(0), 'IEX address not set');

    // Calculate total USDC amount and durations
    uint256 totalUsdcAmount = 0;
    uint256[] memory durationsInDays = new uint256[](spaceIds.length);

    for (uint256 i = 0; i < usdcAmounts.length; i++) {
      // Calculate duration in days based on USDC amount
      durationsInDays[i] = usdcAmounts[i] / USDC_PER_DAY;

      // Ensure minimum payment of 1 day
      require(durationsInDays[i] > 0, 'Payment too small for space');

      totalUsdcAmount = totalUsdcAmount + usdcAmounts[i];
    }

    // Update distribution state before adding new tokens to the distribution
    updateDistributionState();

    // Transfer total USDC from user to the IEX address instead of this contract
    require(
      usdc.transferFrom(msg.sender, iexAddress, totalUsdcAmount),
      'USDC transfer failed'
    );

    // Calculate equivalent HYPHA tokens based on price (not minted to user)
    uint256 hyphaEquivalent = (totalUsdcAmount * 10 ** 18) / HYPHA_PRICE_USD;

    // Calculate total HYPHA to be distributed
    uint256 distributionAmount = hyphaEquivalent * (distributionMultiplier + 1);

    // Ensure we don't exceed max supply with distribution
    require(
      totalMinted + distributionAmount <= MAX_SUPPLY,
      'Exceeds max token supply'
    );

    // Add all tokens to the distribution pool
    pendingDistribution = pendingDistribution + distributionAmount;
    totalMinted = totalMinted + distributionAmount;

    // Update payment information for each space
    for (uint256 i = 0; i < spaceIds.length; i++) {
      paymentTracker.updateSpacePayment(
        msg.sender,
        spaceIds[i],
        durationsInDays[i]
      );
    }

    emit SpacesPaymentProcessed(
      msg.sender,
      spaceIds,
      durationsInDays,
      usdcAmounts,
      0 // No HYPHA is directly minted to the user
    );
  }

  /**
   * @dev Invest in HYPHA directly without space payment
   * @param usdcAmount Amount of USDC to invest
   */
  function investInHypha(uint256 usdcAmount) external {
    require(mainHyphaAddress != address(0), 'MainHypha address not set');

    // Update distribution state before minting new tokens
    updateDistributionState();

    // Transfer USDC from investor to the mainHypha address
    require(
      usdc.transferFrom(msg.sender, mainHyphaAddress, usdcAmount),
      'USDC transfer failed'
    );

    // Calculate HYPHA tokens to purchase based on price
    uint256 hyphaPurchased = (usdcAmount * 10 ** 18) / HYPHA_PRICE_USD;

    // Ensure we don't exceed max supply
    require(
      totalMinted + hyphaPurchased <= MAX_SUPPLY,
      'Exceeds max token supply'
    );

    // Mint HYPHA to the investor
    _mint(msg.sender, hyphaPurchased);
    totalMinted = totalMinted + hyphaPurchased;

    emit HyphaInvestment(msg.sender, usdcAmount, hyphaPurchased);
  }

  /**
   * @dev Updates the global distribution state
   */
  function updateDistributionState() public {
    if (block.timestamp <= lastUpdateTime || totalSupply() == 0) {
      return;
    }

    // Calculate time elapsed since last update
    uint256 timeElapsed = block.timestamp - lastUpdateTime;

    // Calculate emission rate per second based on pending distribution
    // This distributes all pending rewards over a period (e.g., 1 day)
    uint256 DISTRIBUTION_PERIOD = 1 days;
    uint256 emissionRate = pendingDistribution / DISTRIBUTION_PERIOD;

    // Calculate rewards to distribute in this update
    uint256 toDistribute = timeElapsed * emissionRate;
    if (toDistribute > pendingDistribution) {
      toDistribute = pendingDistribution;
    }

    if (toDistribute > 0) {
      // Update accumulated reward per token
      accumulatedRewardPerToken =
        accumulatedRewardPerToken +
        toDistribute /
        totalSupply();

      // Reduce pending distribution
      pendingDistribution = pendingDistribution - toDistribute;

      emit RewardsDistributed(toDistribute, accumulatedRewardPerToken);
    }

    lastUpdateTime = block.timestamp;
  }

  /**
   * @dev Calculate pending rewards for a user
   * @param user Address of the user
   */
  function pendingRewards(address user) public view returns (uint256) {
    if (totalSupply() == 0) {
      return 0;
    }

    uint256 balance = balanceOf(user);

    // Get current accumulator value
    uint256 currentAccumulator = accumulatedRewardPerToken;
    if (
      block.timestamp > lastUpdateTime &&
      totalSupply() > 0 &&
      pendingDistribution > 0
    ) {
      uint256 timeElapsed = block.timestamp - lastUpdateTime;
      uint256 DISTRIBUTION_PERIOD = 1 days;
      uint256 emissionRate = pendingDistribution / DISTRIBUTION_PERIOD;
      uint256 toDistribute = timeElapsed * emissionRate;

      if (toDistribute > pendingDistribution) {
        toDistribute = pendingDistribution;
      }

      currentAccumulator = currentAccumulator + toDistribute / totalSupply();
    }

    // New rewards since last claim
    uint256 newRewards = balance * (currentAccumulator - userRewardDebt[user]);

    // Add any previously unclaimed rewards
    return unclaimedRewards[user] + newRewards;
  }

  /**
   * @dev Claim accumulated rewards
   * @param account Address of the user to claim rewards for
   */
  function claimRewards(address account) external {
    updateDistributionState();

    uint256 reward = pendingRewards(account);
    if (reward > 0) {
      // Ensure we don't exceed max supply
      require(totalMinted + reward <= MAX_SUPPLY, 'Exceeds max token supply');

      unclaimedRewards[account] = 0;
      userRewardDebt[account] = accumulatedRewardPerToken;

      // Mint reward tokens to the user
      _mint(account, reward);
      totalMinted = totalMinted + reward;

      emit RewardsClaimed(account, reward);
    }
  }

  /**
   * @dev Update distribution multiplier (governance function)
   */
  function setDistributionMultiplier(uint256 newMultiplier) external onlyOwner {
    distributionMultiplier = newMultiplier;
    emit DistributionMultiplierUpdated(newMultiplier);
  }

  /**
   * @dev Set the payment tracker contract address
   */
  function setPaymentTracker(address _paymentTracker) external onlyOwner {
    require(_paymentTracker != address(0), 'Invalid payment tracker address');
    paymentTracker = ISpacePaymentTracker(_paymentTracker);
  }

  /**
   * @dev Pay for multiple spaces directly with HYPHA tokens
   * @param spaceIds Array of space IDs to pay for
   * @param hyphaAmounts Array of HYPHA amounts for each space
   */
  function payInHypha(
    uint256[] calldata spaceIds,
    uint256[] calldata hyphaAmounts
  ) external {
    require(
      spaceIds.length == hyphaAmounts.length,
      'Input arrays length mismatch'
    );
    require(spaceIds.length > 0, 'No spaces specified');
    require(iexAddress != address(0), 'IEX address not set');

    // Calculate total HYPHA required and durations
    uint256 totalHyphaRequired = 0;
    uint256[] memory durationsInDays = new uint256[](spaceIds.length);

    for (uint256 i = 0; i < hyphaAmounts.length; i++) {
      // Calculate duration in days based on HYPHA amount
      durationsInDays[i] = hyphaAmounts[i] / HYPHA_PER_DAY;

      // Ensure minimum payment of 1 day
      require(durationsInDays[i] > 0, 'Payment too small for space');

      totalHyphaRequired = totalHyphaRequired + hyphaAmounts[i];
    }

    // Check user has sufficient balance
    require(
      balanceOf(msg.sender) >= totalHyphaRequired,
      'Insufficient HYPHA balance'
    );

    // Update distribution state before transferring tokens
    updateDistributionState();

    // Transfer HYPHA tokens from the user to the IEX address instead of burning
    _transfer(msg.sender, iexAddress, totalHyphaRequired);

    // Calculate additional HYPHA to be distributed as rewards
    uint256 distributionAmount = totalHyphaRequired * distributionMultiplier;

    // Ensure we don't exceed max supply with distribution
    uint256 availableForDistribution = MAX_SUPPLY - totalMinted;
    if (distributionAmount > availableForDistribution) {
      distributionAmount = availableForDistribution;
    }

    pendingDistribution = pendingDistribution + distributionAmount;
    totalMinted = totalMinted + distributionAmount;

    // Update payment information for each space
    for (uint256 i = 0; i < spaceIds.length; i++) {
      paymentTracker.updateSpacePayment(
        msg.sender,
        spaceIds[i],
        durationsInDays[i]
      );
    }

    emit SpacesPaymentProcessedWithHypha(
      msg.sender,
      spaceIds,
      durationsInDays,
      totalHyphaRequired,
      0 // No HYPHA is minted directly to the user
    );
  }

  /**
   * @dev Update HYPHA price in USD (governance function)
   */
  function setHyphaPrice(uint256 newPrice) external onlyOwner {
    HYPHA_PRICE_USD = newPrice;
    emit HyphaPriceUpdated(newPrice);
  }

  /**
   * @dev Update USDC per day cost (governance function)
   */
  function setUsdcPerDay(uint256 newAmount) external onlyOwner {
    USDC_PER_DAY = newAmount;
    emit UsdcPerDayUpdated(newAmount);
  }

  /**
   * @dev Update HYPHA per day cost (governance function)
   */
  function setHyphaPerDay(uint256 newAmount) external onlyOwner {
    HYPHA_PER_DAY = newAmount;
    emit HyphaPerDayUpdated(newAmount);
  }
}
