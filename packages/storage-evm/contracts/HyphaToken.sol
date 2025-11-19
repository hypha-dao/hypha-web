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
    // Monthly cost: $11 USD = $0.367 USD per day
    // HYPHA price: exactly $0.25 USD per HYPHA
    // Daily HYPHA cost: $0.367 ÷ $0.25 = 1.468 HYPHA per day
    HYPHA_PRICE_USD = 1; // Used with new scaling factor to achieve $0.25 per HYPHA
    USDC_PER_DAY = 367_000; // 0.367 USDC per day (6 decimals)
    HYPHA_PER_DAY = 1_468_000_000_000_000_000; // 1.468 HYPHA per day (18 decimals)
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  /**
   * @dev Override transfer to allow whitelisted addresses to transfer with special logic
   */
  function transfer(
    address to,
    uint256 amount
  ) public virtual override(ERC20Upgradeable, IHyphaToken) returns (bool) {
    address from = msg.sender;

    // Check if sender is whitelisted for mint transfers
    if (mintTransferWhitelist[from]) {
      return _handleMintTransfer(from, to, amount);
    }

    // Check if sender is whitelisted for normal transfers
    if (normalTransferWhitelist[from]) {
      _transfer(from, to, amount);
      return true;
    }

    // Default behavior: transfers are disabled
    revert('HYPHA Tokens are currently non-transferrable');
  }

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public virtual override(ERC20Upgradeable, IHyphaToken) returns (bool) {
    // Check if from address is whitelisted for mint transfers
    if (mintTransferWhitelist[from]) {
      // Check allowance first
      uint256 currentAllowance = allowance(from, msg.sender);
      if (currentAllowance != type(uint256).max) {
        require(
          currentAllowance >= amount,
          'ERC20: transfer amount exceeds allowance'
        );
        _approve(from, msg.sender, currentAllowance - amount);
      }
      return _handleMintTransfer(from, to, amount);
    }

    // Check if from address is whitelisted for normal transfers
    if (normalTransferWhitelist[from]) {
      return super.transferFrom(from, to, amount);
    }

    // Default behavior: transfers are disabled
    revert('HYPHA Tokens are currently non-transferrable');
  }

  /**
   * @dev Handle transfer with minting capability for whitelisted addresses
   * @param from Address sending tokens
   * @param to Address receiving tokens
   * @param amount Amount to transfer
   */
  function _handleMintTransfer(
    address from,
    address to,
    uint256 amount
  ) internal returns (bool) {
    uint256 senderBalance = balanceOf(from);

    if (senderBalance >= amount) {
      // Sender has enough balance, perform normal transfer
      _transfer(from, to, amount);
    } else {
      // Sender doesn't have enough balance, mint the shortfall to the sender and then transfer
      uint256 shortfall = amount - senderBalance;

      // Ensure we don't exceed max supply
      require(
        totalMinted + shortfall <= MAX_SUPPLY,
        'Exceeds max token supply'
      );

      // Mint the shortfall to the sender
      _mint(from, shortfall);
      totalMinted = totalMinted + shortfall;
      emit TokensMinted(from, shortfall);

      // Now the sender has enough balance, perform the full transfer
      _transfer(from, to, amount);
    }

    return true;
  }

  /**
   * @dev Set whitelist status for both mint and normal transfers for an address
   * @param account Address to update
   * @param mintTransferStatus Whether the address should be whitelisted for mint transfers
   * @param normalTransferStatus Whether the address should be whitelisted for normal transfers
   */
  function setWhitelistStatus(
    address account,
    bool mintTransferStatus,
    bool normalTransferStatus
  ) external onlyOwner {
    require(account != address(0), 'Cannot whitelist zero address');
    mintTransferWhitelist[account] = mintTransferStatus;
    normalTransferWhitelist[account] = normalTransferStatus;
    emit WhitelistStatusUpdated(
      account,
      mintTransferStatus,
      normalTransferStatus
    );
  }

  /**
   * @dev Check if an address is whitelisted for mint transfers
   * @param account Address to check
   */
  function isMintTransferWhitelisted(
    address account
  ) external view returns (bool) {
    return mintTransferWhitelist[account];
  }

  /**
   * @dev Check if an address is whitelisted for normal transfers
   * @param account Address to check
   */
  function isNormalTransferWhitelisted(
    address account
  ) external view returns (bool) {
    return normalTransferWhitelist[account];
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
    // Using same scaling factor as investment: 4 × 10^12 for $0.25 per HYPHA
    uint256 hyphaEquivalent = (totalUsdcAmount * 4 * 10 ** 12) /
      HYPHA_PRICE_USD;

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
    // Correct scaling factor: 4 × 10^12 to achieve exactly $0.25 per HYPHA
    // Formula: 0.25 USDC (250,000 wei) × 4 × 10^12 ÷ 1 = 1 HYPHA (10^18 wei)
    uint256 hyphaPurchased = (usdcAmount * 4 * 10 ** 12) / HYPHA_PRICE_USD;

    // Ensure we don't exceed max supply
    require(
      totalMinted + hyphaPurchased <= MAX_SUPPLY,
      'Exceeds max token supply'
    );

    // Mint HYPHA to the investor
    _mint(msg.sender, hyphaPurchased);
    totalMinted = totalMinted + hyphaPurchased;
    // Update the user's reward debt to prevent claiming rewards from before they had tokens
    userRewardDebt[msg.sender] = accumulatedRewardPerToken;

    emit HyphaInvestment(msg.sender, usdcAmount, hyphaPurchased);
  }

  /**
   * @dev Updates the global distribution state
   */
  function updateDistributionState() public {
    uint256 eligibleSupply = getEligibleSupply();
    if (block.timestamp <= lastUpdateTime || eligibleSupply == 0) {
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
      // Update accumulated reward per token with higher precision
      uint256 PRECISION = 1e18;
      accumulatedRewardPerToken =
        accumulatedRewardPerToken +
        (toDistribute * PRECISION) /
        eligibleSupply;

      // Reduce pending distribution
      pendingDistribution = pendingDistribution - toDistribute;

      emit RewardsDistributed(toDistribute, accumulatedRewardPerToken);
    }

    lastUpdateTime = block.timestamp;
  }

  /**
   * @dev Calculate eligible supply for reward distribution (excludes IEX address)
   */
  function getEligibleSupply() public view returns (uint256) {
    if (iexAddress == address(0)) {
      return totalSupply();
    }
    uint256 iexBalance = balanceOf(iexAddress);
    uint256 currentTotalSupply = totalSupply();
    if (iexBalance >= currentTotalSupply) {
      return 0;
    }
    return currentTotalSupply - iexBalance;
  }

  /**
   * @dev Calculate pending rewards for a user
   * @param user Address of the user
   */
  function pendingRewards(address user) public view returns (uint256) {
    // IEX address is not eligible for rewards
    if (user == iexAddress) {
      return 0;
    }

    uint256 eligibleSupply = getEligibleSupply();
    if (eligibleSupply == 0) {
      return 0;
    }

    uint256 balance = balanceOf(user);
    uint256 PRECISION = 1e18;

    // Get current accumulator value
    uint256 currentAccumulator = accumulatedRewardPerToken;
    if (
      block.timestamp > lastUpdateTime &&
      eligibleSupply > 0 &&
      pendingDistribution > 0
    ) {
      uint256 timeElapsed = block.timestamp - lastUpdateTime;
      uint256 DISTRIBUTION_PERIOD = 1 days;
      uint256 emissionRate = pendingDistribution / DISTRIBUTION_PERIOD;
      uint256 toDistribute = timeElapsed * emissionRate;

      if (toDistribute > pendingDistribution) {
        toDistribute = pendingDistribution;
      }

      currentAccumulator =
        currentAccumulator +
        (toDistribute * PRECISION) /
        eligibleSupply;
    }

    // New rewards since last claim, accounting for precision
    uint256 newRewards = (balance *
      (currentAccumulator - userRewardDebt[user])) / PRECISION;

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
      require(totalMinted + reward <= MAX_SUPPLY, 'Exceeds max token supplyy');

      unclaimedRewards[account] = 0;
      userRewardDebt[account] = accumulatedRewardPerToken;

      // Mint reward tokens to the user
      _mint(account, reward);
      totalMinted = totalMinted + reward;
      // We don't need to update userRewardDebt again since we already set it above

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
    require(spaceIds.length > 0, 'No spaces spec');
    require(iexAddress != address(0), 'IEX address n set');

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
   * @dev Update all pricing parameters in one transaction (governance function)
   * @param newHyphaPrice New HYPHA price in USD
   * @param newUsdcPerDay New USDC cost per day
   * @param newHyphaPerDay New HYPHA cost per day
   */
  function setPricingParameters(
    uint256 newHyphaPrice,
    uint256 newUsdcPerDay,
    uint256 newHyphaPerDay
  ) external onlyOwner {
    HYPHA_PRICE_USD = newHyphaPrice;
    USDC_PER_DAY = newUsdcPerDay;
    HYPHA_PER_DAY = newHyphaPerDay;

    emit PricingParametersUpdated(newHyphaPrice, newUsdcPerDay, newHyphaPerDay);
  }

  /**
   * @dev Mint HYPHA tokens to a specified address
   * @param to Address to receive the minted tokens
   * @param amount Amount of HYPHA tokens to mint
   */
  function mint(address to, uint256 amount) external {
    require(
      mintTransferWhitelist[msg.sender],
      'Only whitelisted addresses can mint'
    );
    require(to != address(0), 'Cannot mint to zero address');
    require(amount > 0, 'Amount must be greater than zero');
    require(totalMinted + amount <= MAX_SUPPLY, 'Exceeds max token supply');

    // Update total minted
    totalMinted = totalMinted + amount;

    // Mint tokens to the specified address
    _mint(to, amount);

    emit TokensMinted(to, amount);
  }

  /**
   * @dev Burn HYPHA tokens from any address (owner only)
   * @param from Address to burn tokens from
   * @param amount Amount of HYPHA tokens to burn
   */
  function burnFrom(address from, uint256 amount) external override onlyOwner {
    require(amount > 0, 'Amount must be greater than zero');
    require(from != address(0), 'Cannot burn from zero address');
    require(balanceOf(from) >= amount, 'Insufficient balance to burn');

    // Update distribution state before burning
    updateDistributionState();
    // Burn tokens - removes them from circulation entirely
    _burn(from, amount);
    // Forfeit any unclaimed rewards for the burned address (except IEX)
    if (from != iexAddress) {
      unclaimedRewards[from] = 0;
      userRewardDebt[from] = accumulatedRewardPerToken;
    }

    emit TokensBurned(from, amount);
  }

  /**
   * @dev Handle reward accounting before any token transfer, mint, or burn
   * @param from Address sending tokens (address(0) for minting)
   * @param to Address receiving tokens (address(0) for burning)
   * @param amount Amount of tokens transferred
   */
  function _update(
    address from,
    address to,
    uint256 amount
  ) internal virtual override {
    if (amount > 0) {
      // Update global distribution state first
      updateDistributionState();

      // Handle sender rewards (except for minting and IEX address)
      if (from != address(0) && from != iexAddress) {
        uint256 reward = pendingRewards(from);
        if (reward > 0) {
          unclaimedRewards[from] = reward;
        }
        userRewardDebt[from] = accumulatedRewardPerToken;
      }

      // Handle receiver rewards (except for burning and IEX address)
      if (to != address(0) && to != iexAddress) {
        uint256 reward = pendingRewards(to);
        if (reward > 0) {
          unclaimedRewards[to] = reward;
        }
        userRewardDebt[to] = accumulatedRewardPerToken;
      }
    }

    // Call parent implementation to perform the actual transfer/mint/burn
    super._update(from, to, amount);
  }
}
