// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

/**
 * @title OSwaps
 * @dev Multi-token liquidity pool implementing Balancer invariant formula
 *
 * The OSwaps contract implements a token conversion service based on a
 * multilateral token pool using the "balancer" invariant V = B1^W1 * B2^W2 * ... * Bn^Wn
 *
 * Features:
 * - Add liquidity with single-sided deposits
 * - Withdraw liquidity
 * - Token swaps between any pool tokens
 * - Dynamic weight adjustment during liquidity changes
 */
contract OSwaps is Ownable, ReentrancyGuard {
  // ============ Structs ============

  struct AssetInfo {
    uint64 tokenId;
    address contractAddress;
    string symbol;
    bool active;
    string metadata;
    uint256 weight; // Stored as fixed point with 18 decimals (1.0 = 1e18)
  }

  struct PoolStatus {
    uint64 tokenId;
    uint256 balance;
    uint256 weight;
  }

  struct Config {
    address manager;
    bytes32 chainId;
    uint64 lastTokenId;
  }

  // ============ State Variables ============

  Config public config;

  // tokenId => AssetInfo
  mapping(uint64 => AssetInfo) public assets;

  // tokenId => LIQ token contract
  mapping(uint64 => address) public liquidityTokens;

  // Track all token IDs
  uint64[] public tokenIds;

  // Events
  event AssetCreated(
    uint64 indexed tokenId,
    address indexed tokenContract,
    string symbol
  );
  event AssetFrozen(uint64 indexed tokenId, bool frozen);
  event LiquidityAdded(
    address indexed account,
    uint64 indexed tokenId,
    uint256 amount,
    uint256 liqTokensMinted
  );
  event LiquidityWithdrawn(
    address indexed account,
    uint64 indexed tokenId,
    uint256 amount,
    uint256 liqTokensBurned
  );
  event TokenSwapped(
    address indexed sender,
    address indexed recipient,
    uint64 inTokenId,
    uint64 outTokenId,
    uint256 inAmount,
    uint256 outAmount
  );

  // ============ Modifiers ============

  modifier onlyManager() {
    require(msg.sender == config.manager, 'Only manager');
    _;
  }

  modifier onlyActive(uint64 tokenId) {
    require(assets[tokenId].active, 'Token is frozen');
    _;
  }

  // ============ Constructor ============

  constructor() Ownable(msg.sender) {
    config.chainId = blockhash(block.number - 1);
    config.lastTokenId = 0;
  }

  // ============ Admin Functions ============

  /**
   * @dev Initialize the contract with manager
   * @param manager The manager address
   */
  function init(address manager) external onlyOwner {
    require(config.manager == address(0), 'Already initialized');
    config.manager = manager;
  }

  /**
   * @dev Freeze a token (prevent swaps)
   */
  function freeze(uint64 tokenId, string calldata symbol) external onlyManager {
    require(bytes(assets[tokenId].symbol).length > 0, 'Token not found');
    require(
      keccak256(bytes(assets[tokenId].symbol)) == keccak256(bytes(symbol)),
      'Symbol mismatch'
    );
    assets[tokenId].active = false;
    emit AssetFrozen(tokenId, true);
  }

  /**
   * @dev Unfreeze a token (allow swaps)
   */
  function unfreeze(
    uint64 tokenId,
    string calldata symbol
  ) external onlyManager {
    require(bytes(assets[tokenId].symbol).length > 0, 'Token not found');
    require(
      keccak256(bytes(assets[tokenId].symbol)) == keccak256(bytes(symbol)),
      'Symbol mismatch'
    );
    assets[tokenId].active = true;
    emit AssetFrozen(tokenId, false);
  }

  // ============ Asset Management ============

  /**
   * @dev Create a new asset entry and corresponding LIQ token
   */
  function createAsset(
    address tokenContract,
    string calldata symbol,
    string calldata metadata
  ) external returns (uint64 tokenId) {
    require(tokenContract != address(this), 'Cannot be oswaps');

    config.lastTokenId++;
    tokenId = config.lastTokenId;

    assets[tokenId] = AssetInfo({
      tokenId: tokenId,
      contractAddress: tokenContract,
      symbol: symbol,
      active: false,
      metadata: metadata,
      weight: 0
    });

    tokenIds.push(tokenId);

    // Create LIQ token
    string memory liqSymbol = string(
      abi.encodePacked('LIQ', _uint64ToString(tokenId))
    );
    LiquidityToken liqToken = new LiquidityToken(
      liqSymbol,
      liqSymbol,
      address(this)
    );
    liquidityTokens[tokenId] = address(liqToken);

    emit AssetCreated(tokenId, tokenContract, symbol);

    return tokenId;
  }

  /**
   * @dev Remove an asset from the pool
   */
  function forgetAsset(uint64 tokenId) external onlyManager {
    require(bytes(assets[tokenId].symbol).length > 0, 'Token not found');
    delete assets[tokenId];
  }

  // ============ Query Functions ============

  /**
   * @dev Query pool status for given token IDs
   */
  function queryPool(
    uint64[] calldata tokenIdList
  ) external view returns (PoolStatus[] memory) {
    PoolStatus[] memory statuses = new PoolStatus[](tokenIdList.length);

    for (uint i = 0; i < tokenIdList.length; i++) {
      uint64 tokenId = tokenIdList[i];
      require(bytes(assets[tokenId].symbol).length > 0, 'Token not found');

      address tokenContract = assets[tokenId].contractAddress;
      uint256 balance = IERC20(tokenContract).balanceOf(address(this));

      statuses[i] = PoolStatus({
        tokenId: tokenId,
        balance: balance,
        weight: assets[tokenId].weight
      });
    }

    return statuses;
  }

  // ============ Liquidity Functions ============

  /**
   * @dev Add liquidity to pool
   * @param tokenId Token ID to add
   * @param amount Amount to add
   * @param weight New weight (0 to maintain price)
   */
  function addLiquidity(
    uint64 tokenId,
    uint256 amount,
    uint256 weight
  ) external nonReentrant {
    require(bytes(assets[tokenId].symbol).length > 0, 'Token not found');
    require(assets[tokenId].active || amount == 0, 'Token is frozen');

    address tokenContract = assets[tokenId].contractAddress;
    uint256 balBefore = IERC20(tokenContract).balanceOf(address(this));

    // Transfer tokens to pool
    require(
      IERC20(tokenContract).transferFrom(msg.sender, address(this), amount),
      'Transfer failed'
    );

    // Calculate new weight
    uint256 newWeight = weight;
    if (weight == 0 && balBefore > 0) {
      // Maintain price: w_new = w_old * (1 + amount/balance)
      newWeight = (assets[tokenId].weight * (balBefore + amount)) / balBefore;
    }

    assets[tokenId].weight = newWeight;
    if (weight != 0) {
      assets[tokenId].active = false; // Freeze if price changed
    }

    // Mint LIQ tokens
    if (amount > 0) {
      LiquidityToken(liquidityTokens[tokenId]).mint(msg.sender, amount);
      emit LiquidityAdded(msg.sender, tokenId, amount, amount);
    }
  }

  /**
   * @dev Withdraw liquidity from pool
   * @param account Account to receive tokens
   * @param tokenId Token ID to withdraw
   * @param amount Amount to withdraw
   * @param weight New weight (0 to maintain price)
   */
  function withdraw(
    address account,
    uint64 tokenId,
    uint256 amount,
    uint256 weight
  ) external onlyManager nonReentrant {
    require(bytes(assets[tokenId].symbol).length > 0, 'Token not found');

    address tokenContract = assets[tokenId].contractAddress;
    uint256 balBefore = IERC20(tokenContract).balanceOf(address(this));
    require(balBefore > amount, 'Insufficient balance');

    // Calculate new weight
    uint256 newWeight = weight;
    if (weight == 0) {
      // Maintain price: w_new = w_old * (1 - amount/balance)
      newWeight = (assets[tokenId].weight * (balBefore - amount)) / balBefore;
    }

    assets[tokenId].weight = newWeight;
    if (weight != 0) {
      assets[tokenId].active = false; // Freeze if price changed
    }

    // Burn LIQ tokens from account
    LiquidityToken(liquidityTokens[tokenId]).burnFrom(account, amount);

    // Transfer tokens out
    require(IERC20(tokenContract).transfer(account, amount), 'Transfer failed');

    emit LiquidityWithdrawn(account, tokenId, amount, amount);
  }

  // ============ Swap Functions ============

  /**
   * @dev Swap tokens with exact input amount
   * @param recipient Recipient of output tokens
   * @param inTokenId Input token ID
   * @param outTokenId Output token ID
   * @param inAmount Exact input amount
   * @return outAmount Computed output amount
   */
  function swapExactIn(
    address recipient,
    uint64 inTokenId,
    uint64 outTokenId,
    uint256 inAmount
  ) external nonReentrant returns (uint256 outAmount) {
    require(
      bytes(assets[inTokenId].symbol).length > 0,
      'Input token not found'
    );
    require(
      bytes(assets[outTokenId].symbol).length > 0,
      'Output token not found'
    );
    require(assets[inTokenId].active, 'Input token frozen');
    require(assets[outTokenId].active, 'Output token frozen');

    address inContract = assets[inTokenId].contractAddress;
    address outContract = assets[outTokenId].contractAddress;

    uint256 inBalBefore = IERC20(inContract).balanceOf(address(this));
    uint256 outBalBefore = IERC20(outContract).balanceOf(address(this));
    require(inBalBefore > 0, 'Zero input balance');

    // Transfer input tokens
    require(
      IERC20(inContract).transferFrom(msg.sender, address(this), inAmount),
      'Transfer failed'
    );

    // Balancer formula: out_bal_after = out_bal_before * (in_bal_after/in_bal_before)^(-w_in/w_out)
    uint256 inBalAfter = inBalBefore + inAmount;
    outAmount = _computeBalancerOut(
      inBalBefore,
      inBalAfter,
      outBalBefore,
      assets[inTokenId].weight,
      assets[outTokenId].weight
    );

    require(outAmount > 0 && outAmount < outBalBefore, 'Invalid output amount');

    // Transfer output tokens
    require(
      IERC20(outContract).transfer(recipient, outAmount),
      'Transfer failed'
    );

    emit TokenSwapped(
      msg.sender,
      recipient,
      inTokenId,
      outTokenId,
      inAmount,
      outAmount
    );

    return outAmount;
  }

  /**
   * @dev Swap tokens with exact output amount
   * @param recipient Recipient of output tokens
   * @param inTokenId Input token ID
   * @param outTokenId Output token ID
   * @param outAmount Exact output amount
   * @param maxInAmount Maximum input amount willing to pay
   * @return inAmount Computed input amount
   */
  function swapExactOut(
    address recipient,
    uint64 inTokenId,
    uint64 outTokenId,
    uint256 outAmount,
    uint256 maxInAmount
  ) external nonReentrant returns (uint256 inAmount) {
    require(
      bytes(assets[inTokenId].symbol).length > 0,
      'Input token not found'
    );
    require(
      bytes(assets[outTokenId].symbol).length > 0,
      'Output token not found'
    );
    require(assets[inTokenId].active, 'Input token frozen');
    require(assets[outTokenId].active, 'Output token frozen');

    address inContract = assets[inTokenId].contractAddress;
    address outContract = assets[outTokenId].contractAddress;

    uint256 inBalBefore = IERC20(inContract).balanceOf(address(this));
    uint256 outBalBefore = IERC20(outContract).balanceOf(address(this));
    require(inBalBefore > 0, 'Zero input balance');
    require(outBalBefore > outAmount, 'Insufficient output balance');

    // Balancer formula: in_bal_after = in_bal_before * (out_bal_after/out_bal_before)^(-w_out/w_in)
    uint256 outBalAfter = outBalBefore - outAmount;
    inAmount = _computeBalancerIn(
      inBalBefore,
      outBalBefore,
      outBalAfter,
      assets[inTokenId].weight,
      assets[outTokenId].weight
    );

    require(inAmount <= maxInAmount, 'Excessive input amount');

    // Transfer input tokens
    require(
      IERC20(inContract).transferFrom(msg.sender, address(this), inAmount),
      'Transfer failed'
    );

    // Transfer output tokens
    require(
      IERC20(outContract).transfer(recipient, outAmount),
      'Transfer failed'
    );

    emit TokenSwapped(
      msg.sender,
      recipient,
      inTokenId,
      outTokenId,
      inAmount,
      outAmount
    );

    return inAmount;
  }

  // ============ Internal Helpers ============

  /**
   * @dev Compute output amount using Balancer formula
   * Uses natural logarithm approximation for gas efficiency
   */
  function _computeBalancerOut(
    uint256 inBalBefore,
    uint256 inBalAfter,
    uint256 outBalBefore,
    uint256 wIn,
    uint256 wOut
  ) internal pure returns (uint256) {
    // out_bal_after = out_bal_before * (in_bal_after/in_bal_before)^(-w_in/w_out)
    // Simplified: out_bal_after = out_bal_before * exp(-(w_in/w_out) * ln(in_bal_after/in_bal_before))

    // Calculate ratio with precision
    uint256 ratio = (inBalAfter * 1e18) / inBalBefore;
    int256 lnRatio = _ln(int256(ratio));
    int256 exponent = -(int256(wIn) * lnRatio) / int256(wOut);
    uint256 expResult = uint256(_exp(exponent));

    uint256 outBalAfter = (outBalBefore * expResult) / 1e18;
    return outBalBefore - outBalAfter;
  }

  /**
   * @dev Compute input amount using Balancer formula
   */
  function _computeBalancerIn(
    uint256 inBalBefore,
    uint256 outBalBefore,
    uint256 outBalAfter,
    uint256 wIn,
    uint256 wOut
  ) internal pure returns (uint256) {
    // in_bal_after = in_bal_before * (out_bal_after/out_bal_before)^(-w_out/w_in)

    uint256 ratio = (outBalAfter * 1e18) / outBalBefore;
    int256 lnRatio = _ln(int256(ratio));
    int256 exponent = -(int256(wOut) * lnRatio) / int256(wIn);
    uint256 expResult = uint256(_exp(exponent));

    uint256 inBalAfter = (inBalBefore * expResult) / 1e18;
    return inBalAfter - inBalBefore;
  }

  /**
   * @dev Natural logarithm approximation (ln)
   * Input: x in fixed point (1e18 = 1.0)
   * Output: ln(x) in fixed point
   */
  function _ln(int256 x) internal pure returns (int256) {
    require(x > 0, 'ln: x must be positive');

    // Taylor series approximation around x=1
    // ln(x) ≈ (x-1) - (x-1)^2/2 + (x-1)^3/3 - ...
    int256 one = 1e18;
    int256 diff = x - one;

    if (diff == 0) return 0;

    // For better accuracy, use: ln(x) = ln(x/1) when x close to 1
    int256 result = diff;
    int256 term = diff;

    for (uint i = 2; i <= 10; i++) {
      term = (term * diff) / one;
      if (i % 2 == 0) {
        result -= term / int256(i);
      } else {
        result += term / int256(i);
      }
    }

    return result;
  }

  /**
   * @dev Exponential function approximation (e^x)
   * Input: x in fixed point (1e18 = 1.0)
   * Output: e^x in fixed point
   */
  function _exp(int256 x) internal pure returns (int256) {
    int256 one = 1e18;

    // Taylor series: e^x = 1 + x + x^2/2! + x^3/3! + ...
    int256 result = one;
    int256 term = one;

    for (uint i = 1; i <= 20; i++) {
      term = (term * x) / (int256(i) * one);
      result += term;
      if (term == 0) break;
    }

    return result;
  }

  function _uint64ToString(uint64 value) internal pure returns (string memory) {
    if (value == 0) return '0';

    uint64 temp = value;
    uint256 digits;
    while (temp != 0) {
      digits++;
      temp /= 10;
    }

    bytes memory buffer = new bytes(digits);
    while (value != 0) {
      digits -= 1;
      buffer[digits] = bytes1(uint8(48 + uint64(value % 10)));
      value /= 10;
    }

    return string(buffer);
  }

  // ============ Emergency ============

  function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
    require(IERC20(token).transfer(owner(), amount), 'Transfer failed');
  }
}

/**
 * @title LiquidityToken
 * @dev ERC20 token representing liquidity pool shares
 */
contract LiquidityToken is ERC20, Ownable {
  constructor(
    string memory name,
    string memory symbol,
    address owner
  ) ERC20(name, symbol) Ownable(owner) {}

  function mint(address to, uint256 amount) external onlyOwner {
    _mint(to, amount);
  }

  function burnFrom(address from, uint256 amount) external onlyOwner {
    _burn(from, amount);
  }
}
