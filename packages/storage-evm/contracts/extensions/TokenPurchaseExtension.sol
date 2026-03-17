// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../interfaces/ITokenExtension.sol';

/**
 * @title TokenPurchaseExtension
 * @dev USDC purchase module for unified SpaceToken.
 *      - Transfers USDC from buyer to space treasury (executor)
 *      - Delivers purchased tokens from treasury first, then mints shortfall
 *      - Keeps token purchase state isolated from the base token storage
 */
contract TokenPurchaseExtension is Initializable, ITokenExtension {
  using SafeERC20 for IERC20;

  address public token;
  address public usdcToken;
  bool public purchaseEnabled;
  uint256 public customPrice;
  uint256 public maxTokensForSale;
  uint256 public soldTokens;

  event TokenPurchaseConfigUpdated(
    address indexed usdcToken,
    bool enabled,
    uint256 customPrice,
    uint256 maxTokensForSale,
    bool soldCounterReset
  );
  event SpaceTokenPurchased(
    address indexed buyer,
    address indexed recipient,
    uint256 usdcAmount,
    uint256 tokenAmount
  );

  function initialize(
    address _usdcToken,
    bool _enabled,
    uint256 _customPrice,
    uint256 _maxTokensForSale
  ) external initializer {
    usdcToken = _usdcToken;
    purchaseEnabled = _enabled;
    customPrice = _customPrice;
    maxTokensForSale = _maxTokensForSale;
  }

  function setToken(address _token) external override {
    require(token == address(0), 'Already linked');
    token = _token;
  }

  modifier onlyToken() {
    require(msg.sender == token, 'Only token');
    _;
  }

  modifier onlyExecutor() {
    require(
      msg.sender == ISpaceTokenBase(token).executor(),
      'Only executor'
    );
    _;
  }

  function configureTokenPurchase(
    address _usdcToken,
    bool enabled,
    uint256 _customPrice,
    uint256 _maxTokensForSale,
    bool resetSoldCounter
  ) external onlyExecutor {
    if (enabled) {
      require(_usdcToken != address(0), 'USDC token cannot be zero address');
    }

    usdcToken = _usdcToken;
    purchaseEnabled = enabled;
    customPrice = _customPrice;
    maxTokensForSale = _maxTokensForSale;
    if (resetSoldCounter) {
      soldTokens = 0;
    }

    emit TokenPurchaseConfigUpdated(
      _usdcToken,
      enabled,
      _customPrice,
      _maxTokensForSale,
      resetSoldCounter
    );
  }

  function buyWithUSDC(
    uint256 tokenAmount,
    uint256 maxUsdcAmount,
    address recipient
  ) external returns (uint256 usdcAmount) {
    ISpaceTokenBase _token = ISpaceTokenBase(token);

    require(!_token.archived(), 'Token is archived');
    require(purchaseEnabled, 'Token purchase is disabled');
    require(usdcToken != address(0), 'USDC token is not configured');
    require(tokenAmount > 0, 'Token amount must be greater than zero');
    require(recipient != address(0), 'Recipient cannot be zero address');
    require(
      _token.canPurchaseRecipient(recipient),
      'Recipient not allowed to buy'
    );

    uint256 available = getTokensAvailableForPurchaseLimit();
    require(
      tokenAmount <= available,
      'Requested amount exceeds purchase availability'
    );

    usdcAmount = quoteUsdcForTokenAmount(tokenAmount);
    require(usdcAmount <= maxUsdcAmount, 'USDC amount exceeds max slippage');

    address treasury = _token.executor();
    IERC20(usdcToken).safeTransferFrom(msg.sender, treasury, usdcAmount);

    uint256 treasuryBalance = _token.rawBalanceOf(treasury);
    uint256 fromTreasury = treasuryBalance < tokenAmount
      ? treasuryBalance
      : tokenAmount;

    if (fromTreasury > 0) {
      _token.extensionTransferFromExecutor(recipient, fromTreasury);
    }

    uint256 toMint = tokenAmount - fromTreasury;
    if (toMint > 0) {
      uint256 cap = _token.maxSupply();
      require(
        cap == 0 || IERC20(token).totalSupply() + toMint <= cap,
        'Exceeds max supply'
      );
      _token.extensionMint(recipient, toMint);
    }

    soldTokens += tokenAmount;

    emit SpaceTokenPurchased(msg.sender, recipient, usdcAmount, tokenAmount);
  }

  function getTokenPurchaseConfig()
    external
    view
    returns (
      address configuredUsdcToken,
      bool enabled,
      uint256 configuredCustomPrice,
      uint256 effectivePrice,
      uint256 configuredMaxTokensForSale,
      uint256 totalSoldTokens,
      uint256 availableToBuy
    )
  {
    configuredUsdcToken = usdcToken;
    enabled = purchaseEnabled;
    configuredCustomPrice = customPrice;
    effectivePrice = _effectivePurchasePrice();
    configuredMaxTokensForSale = maxTokensForSale;
    totalSoldTokens = soldTokens;
    availableToBuy = getTokensAvailableForPurchaseLimit();
  }

  function getTokensAvailableForPurchaseLimit() public view returns (uint256) {
    ISpaceTokenBase _token = ISpaceTokenBase(token);

    uint256 campaignRemaining = type(uint256).max;
    if (maxTokensForSale > 0) {
      if (soldTokens >= maxTokensForSale) {
        return 0;
      }
      campaignRemaining = maxTokensForSale - soldTokens;
    }

    uint256 cap = _token.maxSupply();
    if (cap == 0) {
      return campaignRemaining;
    }

    uint256 unissued = cap > IERC20(token).totalSupply()
      ? cap - IERC20(token).totalSupply()
      : 0;
    uint256 treasuryBalance = _token.rawBalanceOf(_token.executor());
    uint256 hardLimit = unissued + treasuryBalance;
    return hardLimit < campaignRemaining ? hardLimit : campaignRemaining;
  }

  function quoteUsdcForTokenAmount(
    uint256 tokenAmount
  ) public view returns (uint256) {
    uint256 price = _effectivePurchasePrice();
    require(price > 0, 'Purchase price not configured');
    if (tokenAmount == 0) return 0;
    return ((tokenAmount * price) + (1e18 - 1)) / 1e18;
  }

  function quoteTokenAmountForUsdc(uint256 usdcAmount) external view returns (uint256) {
    uint256 price = _effectivePurchasePrice();
    require(price > 0, 'Purchase price not configured');
    if (usdcAmount == 0) return 0;
    return (usdcAmount * 1e18) / price;
  }

  function _effectivePurchasePrice() internal view returns (uint256) {
    if (customPrice > 0) {
      return customPrice;
    }
    return ISpaceTokenBase(token).tokenPrice();
  }

  // Hook no-ops: this extension does not modify transfer pipeline automatically.
  function beforeTransfer(
    address,
    address,
    uint256
  ) external override onlyToken {}

  function afterTransfer(
    address,
    address,
    uint256
  ) external override onlyToken {}

  function beforeMint(address, uint256) external override onlyToken {}
}
