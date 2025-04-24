// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import './storage/HyphaTokenStorage.sol';
import './interfaces/ISpacesContract.sol';

contract HyphaToken is
  Initializable,
  ERC20Upgradeable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  HyphaTokenStorage
{
  using SafeMath for uint256;

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

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address _usdc,
    address _spacesContract
  ) public initializer {
    __ERC20_init('HYPHA', 'HYPHA');
    __Ownable_init(msg.sender);
    __UUPSUpgradeable_init();

    usdc = IERC20(_usdc);
    spacesContract = ISpacesContract(_spacesContract);
    lastUpdateTime = block.timestamp;
    totalMinted = 0;
    distributionMultiplier = 10; // Initial value
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  /**
   * @dev Override _transfer to make the token non-transferable
   */
  function _transfer(address, address, uint256) internal pure override {
    revert('HYPHA: Transfers disabled');
  }

  /**
   * @dev Pay for spaces with USDC and distribute HYPHA tokens
   * @param usdcAmount Amount of USDC paid
   * @param spaceId ID of the space being paid for
   * @param durationInDays Duration of the payment in days
   */
  function payForSpaces(
    uint256 usdcAmount,
    uint256 spaceId,
    uint256 durationInDays
  ) external {
    // Update distribution state before minting new tokens
    updateDistributionState();

    // Transfer USDC from user
    require(
      usdc.transferFrom(msg.sender, address(this), usdcAmount),
      'USDC transfer failed'
    );

    // Calculate HYPHA tokens to mint based on price
    uint256 hyphaMinted = usdcAmount.mul(10 ** 18).div(HYPHA_PRICE_USD);

    // Ensure we don't exceed max supply
    require(
      totalMinted.add(hyphaMinted) <= MAX_SUPPLY,
      'Exceeds max token supply'
    );

    // Mint HYPHA to the user who paid
    _mint(msg.sender, hyphaMinted);
    totalMinted = totalMinted.add(hyphaMinted);

    // Calculate additional HYPHA to be distributed
    uint256 distributionAmount = hyphaMinted.mul(distributionMultiplier);

    // Ensure we don't exceed max supply with distribution
    uint256 availableForDistribution = MAX_SUPPLY.sub(totalMinted);
    if (distributionAmount > availableForDistribution) {
      distributionAmount = availableForDistribution;
    }

    pendingDistribution = pendingDistribution.add(distributionAmount);
    totalMinted = totalMinted.add(distributionAmount);

    // Update the spaces contract
    spacesContract.updateSpacePayment(msg.sender, spaceId, durationInDays);

    emit SpacePaymentProcessed(
      msg.sender,
      spaceId,
      durationInDays,
      usdcAmount,
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
    uint256 hyphaPurchased = usdcAmount.mul(10 ** 18).div(HYPHA_PRICE_USD);

    // Ensure we don't exceed max supply
    require(
      totalMinted.add(hyphaPurchased) <= MAX_SUPPLY,
      'Exceeds max token supply'
    );

    // Mint HYPHA to the investor
    _mint(msg.sender, hyphaPurchased);
    totalMinted = totalMinted.add(hyphaPurchased);

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
    uint256 timeElapsed = block.timestamp.sub(lastUpdateTime);

    // Calculate emission rate per second based on pending distribution
    // This distributes all pending rewards over a period (e.g., 1 day)
    uint256 DISTRIBUTION_PERIOD = 1 days;
    uint256 emissionRate = pendingDistribution.div(DISTRIBUTION_PERIOD);

    // Calculate rewards to distribute in this update
    uint256 toDistribute = timeElapsed.mul(emissionRate);
    if (toDistribute > pendingDistribution) {
      toDistribute = pendingDistribution;
    }

    if (toDistribute > 0) {
      // Update accumulated reward per token
      accumulatedRewardPerToken = accumulatedRewardPerToken.add(
        toDistribute.div(totalSupply())
      );

      // Reduce pending distribution
      pendingDistribution = pendingDistribution.sub(toDistribute);

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
      uint256 timeElapsed = block.timestamp.sub(lastUpdateTime);
      uint256 DISTRIBUTION_PERIOD = 1 days;
      uint256 emissionRate = pendingDistribution.div(DISTRIBUTION_PERIOD);
      uint256 toDistribute = timeElapsed.mul(emissionRate);

      if (toDistribute > pendingDistribution) {
        toDistribute = pendingDistribution;
      }

      currentAccumulator = currentAccumulator.add(
        toDistribute.div(totalSupply())
      );
    }

    // New rewards since last claim
    uint256 newRewards = balance.mul(
      currentAccumulator.sub(userRewardDebt[user])
    );

    // Add any previously unclaimed rewards
    return unclaimedRewards[user].add(newRewards);
  }

  /**
   * @dev Claim accumulated rewards
   */
  function claimRewards() external {
    updateDistributionState();

    uint256 reward = pendingRewards(msg.sender);
    if (reward > 0) {
      // Ensure we don't exceed max supply
      require(
        totalMinted.add(reward) <= MAX_SUPPLY,
        'Exceeds max token supply'
      );

      unclaimedRewards[msg.sender] = 0;
      userRewardDebt[msg.sender] = accumulatedRewardPerToken;

      // Mint reward tokens to the user
      _mint(msg.sender, reward);
      totalMinted = totalMinted.add(reward);

      emit RewardsClaimed(msg.sender, reward);
    }
  }

  /**
   * @dev Update user's reward state when their balance changes
   */
  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal override {
    // Only allow minting operations (from == address(0))
    if (from != address(0)) {
      revert('HYPHA: Transfers disabled');
    }

    updateDistributionState();
    super._beforeTokenTransfer(from, to, amount);
  }

  /**
   * @dev Update distribution multiplier (governance function)
   */
  function setDistributionMultiplier(uint256 newMultiplier) external onlyOwner {
    distributionMultiplier = newMultiplier;
    emit DistributionMultiplierUpdated(newMultiplier);
  }

  /**
   * @dev Set the spaces contract address (governance function)
   */
  function setSpacesContract(address _spacesContract) external onlyOwner {
    spacesContract = ISpacesContract(_spacesContract);
  }
}
