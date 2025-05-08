// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './storage/HyphaTokenStorage.sol';
import './interfaces/ISpacePaymentTracker.sol';

contract HyphaToken is
  Initializable,
  ERC20Upgradeable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  HyphaTokenStorage
{
  // Events
  event SpacePaymentProcessed(
    address indexed user,
    uint256 spaceId,
    uint256 durationInDays,
    uint256 usdcAmount,
    uint256 hyphaMinted
  );
  event HyphaInvestment(
    address indexed investor,
    uint256 usdcAmount,
    uint256 hyphaPurchased
  );
  event RewardsDistributed(
    uint256 amount,
    uint256 newAccumulatedRewardPerToken
  );
  event RewardsClaimed(address indexed user, uint256 amount);
  event DistributionMultiplierUpdated(uint256 newMultiplier);
  event SpacesPaymentProcessed(
    address indexed user,
    uint256[] spaceIds,
    uint256[] durationInDays,
    uint256[] usdcAmounts,
    uint256 totalHyphaMinted
  );

  // Add new variable
  ISpacePaymentTracker public paymentTracker;

  // Constants
  uint256 public constant USDC_PER_MONTH = 11 * 10 ** 6; // 11 USDC with 6 decimals (assuming USDC standard)

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
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  /**
   * @dev Override transfer and transferFrom to make the token non-transferable
   */
  function transfer(address, uint256) public virtual override returns (bool) {
    revert('HYPHA: Transfers disabled');
  }

  function transferFrom(
    address,
    address,
    uint256
  ) public virtual override returns (bool) {
    revert('HYPHA: Transfers disabled');
  }

  /**
   * @dev Pay for multiple spaces with USDC and distribute HYPHA tokens
   * @param spaceIds Array of space IDs to pay for
   * @param durationsInDays Array of durations in days for each space
   * @param usdcAmounts Array of USDC amounts for each space
   */
  function payForSpaces(
    uint256[] calldata spaceIds,
    uint256[] calldata durationsInDays,
    uint256[] calldata usdcAmounts
  ) external {
    require(
      spaceIds.length == durationsInDays.length &&
        spaceIds.length == usdcAmounts.length,
      'Input arrays length mismatch'
    );
    require(spaceIds.length > 0, 'No spaces specified');

    // Calculate total USDC amount
    uint256 totalUsdcAmount = 0;
    for (uint256 i = 0; i < usdcAmounts.length; i++) {
      // Calculate minimum required USDC for this space
      uint256 daysToMonths = durationsInDays[i] / 30;
      if (durationsInDays[i] % 30 > 0) daysToMonths += 1; // Round up to next month
      uint256 requiredUsdcAmount = daysToMonths * USDC_PER_MONTH;

      // Ensure user is paying enough for each space
      require(
        usdcAmounts[i] >= requiredUsdcAmount,
        'Insufficient USDC for space payment'
      );

      totalUsdcAmount = totalUsdcAmount + usdcAmounts[i];
    }

    // Update distribution state before minting new tokens
    updateDistributionState();

    // Transfer total USDC from user
    require(
      usdc.transferFrom(msg.sender, address(this), totalUsdcAmount),
      'USDC transfer failed'
    );

    // Calculate HYPHA tokens to mint based on price
    uint256 hyphaMinted = (totalUsdcAmount * 10 ** 18) / HYPHA_PRICE_USD;

    // Ensure we don't exceed max supply
    require(
      totalMinted + hyphaMinted <= MAX_SUPPLY,
      'Exceeds max token supply'
    );

    // Mint HYPHA to the user who paid
    _mint(msg.sender, hyphaMinted);
    totalMinted = totalMinted + hyphaMinted;

    // Calculate additional HYPHA to be distributed
    uint256 distributionAmount = hyphaMinted * distributionMultiplier;

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

    emit SpacesPaymentProcessed(
      msg.sender,
      spaceIds,
      durationsInDays,
      usdcAmounts,
      hyphaMinted
    );
  }

  /**
   * @dev Invest in HYPHA directly without space payment
   * @param usdcAmount Amount of USDC to invest
   */
  function investInHypha(uint256 usdcAmount) external {
    // Update distribution state before minting new tokens
    updateDistributionState();

    // Transfer USDC from investor
    require(
      usdc.transferFrom(msg.sender, address(this), usdcAmount),
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
   */
  function claimRewards() external {
    updateDistributionState();

    uint256 reward = pendingRewards(msg.sender);
    if (reward > 0) {
      // Ensure we don't exceed max supply
      require(totalMinted + reward <= MAX_SUPPLY, 'Exceeds max token supply');

      unclaimedRewards[msg.sender] = 0;
      userRewardDebt[msg.sender] = accumulatedRewardPerToken;

      // Mint reward tokens to the user
      _mint(msg.sender, reward);
      totalMinted = totalMinted + reward;

      emit RewardsClaimed(msg.sender, reward);
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
}
