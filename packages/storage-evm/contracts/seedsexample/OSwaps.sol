// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import { UD60x18, ud } from '@prb/math/src/UD60x18.sol';

/**
 * @title OSwaps
 * @dev Multi-token liquidity pool implementing the Balancer invariant formula.
 *
 * Port of the Antelope/EOSIO `oswaps` contract. It implements a token conversion
 * service over a multilateral token pool using the "balancer" invariant
 * V = B1^W1 * B2^W2 * ... * Bn^Wn.
 *
 * Features:
 * - Add liquidity with single-sided deposits
 * - Withdraw liquidity
 * - Token swaps between any pool tokens
 * - Dynamic weight adjustment during liquidity changes
 *
 * Weights are meaningful only as ratios: the pricing math uses wIn/wOut, so the
 * absolute scale is arbitrary and weights are not normalised to sum to 1.
 *
 * See OSwaps.docs.md for the full contract reference and OSwaps.EOSIO-PARITY.md
 * for a comparison against the original Antelope implementation.
 */
contract OSwaps is Ownable, ReentrancyGuard {
  using SafeERC20 for IERC20;

  // ============ Structs ============

  struct AssetInfo {
    uint64 tokenId;
    address contractAddress;
    string symbol;
    bool active;
    string metadata;
    uint256 weight;
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

  // ERC-20 address => tokenId, 0 when unregistered. Prevents double registration
  // of the same token, which would give two asset records one shared balance.
  mapping(address => uint64) public tokenIdByAddress;

  // Registered token ids, pruned by forgetAsset
  uint64[] private _tokenIds;

  // tokenId => index into _tokenIds, for O(1) removal
  mapping(uint64 => uint256) private _tokenIdIndex;

  // ============ Events ============

  event ManagerUpdated(address indexed previousManager, address indexed newManager);
  event AssetCreated(
    uint64 indexed tokenId,
    address indexed tokenContract,
    string symbol
  );
  event AssetForgotten(uint64 indexed tokenId, address indexed tokenContract);
  event AssetFrozen(uint64 indexed tokenId, bool frozen);
  event WeightUpdated(
    uint64 indexed tokenId,
    uint256 previousWeight,
    uint256 newWeight,
    bool priceChanged
  );
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
    uint64 indexed inTokenId,
    uint64 outTokenId,
    uint256 inAmount,
    uint256 outAmount
  );

  // ============ Modifiers ============

  modifier onlyManager() {
    require(msg.sender == config.manager, 'Only manager');
    _;
  }

  modifier assetExists(uint64 tokenId) {
    require(assets[tokenId].contractAddress != address(0), 'Token not found');
    _;
  }

  // ============ Constructor ============

  constructor() Ownable(msg.sender) {
    // Informational only, mirroring the original contract's chain_id field. The
    // original recorded the home chain to support future cross-chain assets.
    config.chainId = bytes32(block.chainid);
    config.lastTokenId = 0;
  }

  // ============ Admin Functions ============

  /**
   * @dev Set the initial manager. Callable once by the owner; afterwards the
   * manager rotates itself via setManager.
   */
  function init(address manager) external onlyOwner {
    require(config.manager == address(0), 'Already initialized');
    require(manager != address(0), 'Zero manager');
    config.manager = manager;
    emit ManagerUpdated(address(0), manager);
  }

  /**
   * @dev Transfer manager authority. The original protocol allowed the incumbent
   * manager to hand over to a replacement; this is that path.
   */
  function setManager(address newManager) external onlyManager {
    require(newManager != address(0), 'Zero manager');
    address previous = config.manager;
    config.manager = newManager;
    emit ManagerUpdated(previous, newManager);
  }

  /**
   * @dev Freeze a token, blocking swaps and deposits.
   * @param symbol Must match the stored symbol. A guard against mistyped ids,
   * carried over from the original protocol.
   */
  function freeze(
    uint64 tokenId,
    string calldata symbol
  ) external onlyManager assetExists(tokenId) {
    require(
      keccak256(bytes(assets[tokenId].symbol)) == keccak256(bytes(symbol)),
      'Symbol mismatch'
    );
    assets[tokenId].active = false;
    emit AssetFrozen(tokenId, true);
  }

  /**
   * @dev Unfreeze a token, allowing swaps and deposits.
   */
  function unfreeze(
    uint64 tokenId,
    string calldata symbol
  ) external onlyManager assetExists(tokenId) {
    require(
      keccak256(bytes(assets[tokenId].symbol)) == keccak256(bytes(symbol)),
      'Symbol mismatch'
    );
    assets[tokenId].active = true;
    emit AssetFrozen(tokenId, false);
  }

  // ============ Asset Management ============

  /**
   * @dev Register an ERC-20 in the pool and deploy its LIQ receipt token.
   *
   * The asset starts inactive with zero weight, matching the original protocol.
   * A manager must unfreeze it before the first deposit, and that first deposit
   * must carry a non-zero weight to establish a price.
   */
  function createAsset(
    address tokenContract,
    string calldata symbol,
    string calldata metadata
  ) external returns (uint64 tokenId) {
    require(tokenContract != address(this), 'Cannot be oswaps');
    require(tokenContract != address(0), 'Zero token address');
    require(tokenContract.code.length > 0, 'Token is not a contract');
    require(tokenIdByAddress[tokenContract] == 0, 'Token already registered');

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

    tokenIdByAddress[tokenContract] = tokenId;
    _tokenIdIndex[tokenId] = _tokenIds.length;
    _tokenIds.push(tokenId);

    string memory liqSymbol = string(
      abi.encodePacked('LIQ', _uint64ToString(tokenId))
    );
    liquidityTokens[tokenId] = address(
      new LiquidityToken(
        liqSymbol,
        liqSymbol,
        _readDecimals(tokenContract),
        address(this)
      )
    );

    emit AssetCreated(tokenId, tokenContract, symbol);

    return tokenId;
  }

  /**
   * @dev Remove an asset from the pool.
   *
   * Requires the pool balance to be zero. The original left stranded balances
   * behind; because this contract has no owner-level rescue hatch, a non-empty
   * asset must be drained through withdraw first or its balance would become
   * permanently unreachable.
   */
  function forgetAsset(
    uint64 tokenId
  ) external onlyManager assetExists(tokenId) {
    address tokenContract = assets[tokenId].contractAddress;
    require(
      IERC20(tokenContract).balanceOf(address(this)) == 0,
      'Pool balance not zero'
    );

    uint256 index = _tokenIdIndex[tokenId];
    uint256 lastIndex = _tokenIds.length - 1;
    if (index != lastIndex) {
      uint64 movedId = _tokenIds[lastIndex];
      _tokenIds[index] = movedId;
      _tokenIdIndex[movedId] = index;
    }
    _tokenIds.pop();

    delete _tokenIdIndex[tokenId];
    delete tokenIdByAddress[tokenContract];
    delete liquidityTokens[tokenId];
    delete assets[tokenId];

    emit AssetForgotten(tokenId, tokenContract);
  }

  // ============ Query Functions ============

  /**
   * @dev Pool balances and weights for the given token ids. Reverts if any id in
   * the list is unregistered.
   */
  function queryPool(
    uint64[] calldata tokenIdList
  ) external view returns (PoolStatus[] memory) {
    PoolStatus[] memory statuses = new PoolStatus[](tokenIdList.length);

    for (uint256 i = 0; i < tokenIdList.length; i++) {
      uint64 tokenId = tokenIdList[i];
      address tokenContract = assets[tokenId].contractAddress;
      require(tokenContract != address(0), 'Token not found');

      statuses[i] = PoolStatus({
        tokenId: tokenId,
        balance: IERC20(tokenContract).balanceOf(address(this)),
        weight: assets[tokenId].weight
      });
    }

    return statuses;
  }

  /**
   * @dev All registered token ids. Forgotten ids are pruned, so this is the
   * authoritative enumeration.
   */
  function getTokenIds() external view returns (uint64[] memory) {
    return _tokenIds;
  }

  function getAssetCount() external view returns (uint256) {
    return _tokenIds.length;
  }

  /**
   * @dev The full asset record as a struct. The auto-generated `assets` getter
   * returns flat values, which is not ABI-compatible with a struct return.
   */
  function getAsset(uint64 tokenId) external view returns (AssetInfo memory) {
    return assets[tokenId];
  }

  /**
   * @dev Output amount for a given input, without executing the swap.
   */
  function quoteExactIn(
    uint64 inTokenId,
    uint64 outTokenId,
    uint256 inAmount
  ) external view returns (uint256 outAmount) {
    (uint256 inBalBefore, uint256 outBalBefore) = _requireSwappable(
      inTokenId,
      outTokenId,
      inAmount
    );
    outAmount = _computeBalancerOut(
      inBalBefore,
      inBalBefore + inAmount,
      outBalBefore,
      assets[inTokenId].weight,
      assets[outTokenId].weight
    );
    require(outAmount > 0 && outAmount < outBalBefore, 'Invalid output amount');
  }

  /**
   * @dev Input amount required for a given output, without executing the swap.
   */
  function quoteExactOut(
    uint64 inTokenId,
    uint64 outTokenId,
    uint256 outAmount
  ) external view returns (uint256 inAmount) {
    (uint256 inBalBefore, uint256 outBalBefore) = _requireSwappable(
      inTokenId,
      outTokenId,
      outAmount
    );
    require(outBalBefore > outAmount, 'Insufficient output balance');
    inAmount = _computeBalancerIn(
      inBalBefore,
      outBalBefore,
      outBalBefore - outAmount,
      assets[inTokenId].weight,
      assets[outTokenId].weight
    );
    require(inAmount > 0, 'Invalid input amount');
  }

  // ============ Liquidity Functions ============

  /**
   * @dev Add liquidity to the pool.
   * @param weight New balancer weight, or 0 to recompute a weight that leaves
   * the price unchanged. A non-zero weight changes the price and therefore
   * freezes the asset until a manager unfreezes it.
   *
   * Passing amount = 0 with a non-zero weight reprices the asset without a
   * deposit, and is permitted while the asset is frozen.
   */
  function addLiquidity(
    uint64 tokenId,
    uint256 amount,
    uint256 weight
  ) external nonReentrant assetExists(tokenId) {
    require(assets[tokenId].active || amount == 0, 'Token is frozen');

    address tokenContract = assets[tokenId].contractAddress;
    uint256 balBefore = IERC20(tokenContract).balanceOf(address(this));

    if (amount > 0) {
      IERC20(tokenContract).safeTransferFrom(msg.sender, address(this), amount);
      // Balance-based accounting cannot price fee-on-transfer or rebasing
      // tokens, so reject them rather than misprice the pool.
      require(
        IERC20(tokenContract).balanceOf(address(this)) == balBefore + amount,
        'Unexpected balance change'
      );
    }

    uint256 previousWeight = assets[tokenId].weight;
    uint256 newWeight = weight;
    if (weight == 0) {
      require(balBefore > 0, 'Zero weight requires existing balance');
      // Maintain price: w_new = w_old * (balance + amount) / balance
      newWeight = Math.mulDiv(previousWeight, balBefore + amount, balBefore);
    }

    assets[tokenId].weight = newWeight;
    if (weight != 0) {
      assets[tokenId].active = false;
    }
    emit WeightUpdated(tokenId, previousWeight, newWeight, weight != 0);

    if (amount > 0) {
      LiquidityToken(liquidityTokens[tokenId]).mint(msg.sender, amount);
      emit LiquidityAdded(msg.sender, tokenId, amount, amount);
    }
  }

  /**
   * @dev Withdraw liquidity from the pool. Manager-only, matching the original
   * protocol: liquidity providers cannot exit on their own initiative.
   * @param weight New balancer weight, or 0 to hold the price.
   */
  function withdraw(
    address account,
    uint64 tokenId,
    uint256 amount,
    uint256 weight
  ) external onlyManager nonReentrant assetExists(tokenId) {
    require(amount > 0, 'Zero amount');

    address tokenContract = assets[tokenId].contractAddress;
    uint256 balBefore = IERC20(tokenContract).balanceOf(address(this));
    if (assets[tokenId].active) {
      // A tradeable asset must keep a non-zero balance or its price is
      // undefined. The original enforced this unconditionally.
      require(balBefore > amount, 'Insufficient balance');
    } else {
      // A frozen asset cannot be traded, so it may be drained completely. This
      // is what makes forgetAsset reachable: freeze, drain, forget. Without it,
      // a funded asset could never be retired and would need an owner-level
      // rescue hatch, which the original design deliberately withheld.
      require(balBefore >= amount, 'Insufficient balance');
    }

    uint256 previousWeight = assets[tokenId].weight;
    uint256 newWeight = weight;
    if (weight == 0) {
      // Maintain price: w_new = w_old * (balance - amount) / balance
      newWeight = Math.mulDiv(previousWeight, balBefore - amount, balBefore);
    }

    assets[tokenId].weight = newWeight;
    if (weight != 0) {
      assets[tokenId].active = false;
    }
    emit WeightUpdated(tokenId, previousWeight, newWeight, weight != 0);

    LiquidityToken(liquidityTokens[tokenId]).burnFrom(account, amount);
    IERC20(tokenContract).safeTransfer(account, amount);

    emit LiquidityWithdrawn(account, tokenId, amount, amount);
  }

  // ============ Swap Functions ============

  /**
   * @dev Swap an exact input amount for a computed output.
   * @param minOutAmount Slippage floor. The original protocol had no equivalent;
   * it is required here because EVM transactions are visible in a public mempool
   * before execution.
   */
  function swapExactIn(
    address recipient,
    uint64 inTokenId,
    uint64 outTokenId,
    uint256 inAmount,
    uint256 minOutAmount
  ) external nonReentrant returns (uint256 outAmount) {
    require(recipient != address(0), 'Zero recipient');
    (uint256 inBalBefore, uint256 outBalBefore) = _requireSwappable(
      inTokenId,
      outTokenId,
      inAmount
    );

    outAmount = _computeBalancerOut(
      inBalBefore,
      inBalBefore + inAmount,
      outBalBefore,
      assets[inTokenId].weight,
      assets[outTokenId].weight
    );
    require(outAmount > 0 && outAmount < outBalBefore, 'Invalid output amount');
    require(outAmount >= minOutAmount, 'Insufficient output amount');

    address inContract = assets[inTokenId].contractAddress;
    IERC20(inContract).safeTransferFrom(msg.sender, address(this), inAmount);
    require(
      IERC20(inContract).balanceOf(address(this)) == inBalBefore + inAmount,
      'Unexpected balance change'
    );
    IERC20(assets[outTokenId].contractAddress).safeTransfer(
      recipient,
      outAmount
    );

    emit TokenSwapped(
      msg.sender,
      recipient,
      inTokenId,
      outTokenId,
      inAmount,
      outAmount
    );
  }

  /**
   * @dev Swap a computed input amount for an exact output.
   * @param maxInAmount Cap on the input actually pulled. The original required
   * the sender to overpay and refunded the surplus; pulling the exact amount
   * makes the refund unnecessary.
   */
  function swapExactOut(
    address recipient,
    uint64 inTokenId,
    uint64 outTokenId,
    uint256 outAmount,
    uint256 maxInAmount
  ) external nonReentrant returns (uint256 inAmount) {
    require(recipient != address(0), 'Zero recipient');
    (uint256 inBalBefore, uint256 outBalBefore) = _requireSwappable(
      inTokenId,
      outTokenId,
      outAmount
    );
    require(outBalBefore > outAmount, 'Insufficient output balance');

    inAmount = _computeBalancerIn(
      inBalBefore,
      outBalBefore,
      outBalBefore - outAmount,
      assets[inTokenId].weight,
      assets[outTokenId].weight
    );
    require(inAmount > 0, 'Invalid input amount');
    require(inAmount <= maxInAmount, 'Excessive input amount');

    address inContract = assets[inTokenId].contractAddress;
    IERC20(inContract).safeTransferFrom(msg.sender, address(this), inAmount);
    require(
      IERC20(inContract).balanceOf(address(this)) == inBalBefore + inAmount,
      'Unexpected balance change'
    );
    IERC20(assets[outTokenId].contractAddress).safeTransfer(
      recipient,
      outAmount
    );

    emit TokenSwapped(
      msg.sender,
      recipient,
      inTokenId,
      outTokenId,
      inAmount,
      outAmount
    );
  }

  // ============ Internal Helpers ============

  /**
   * @dev Shared validation for both swap directions and both quote views.
   * @return inBalBefore Pool balance of the input token
   * @return outBalBefore Pool balance of the output token
   */
  function _requireSwappable(
    uint64 inTokenId,
    uint64 outTokenId,
    uint256 amount
  ) internal view returns (uint256 inBalBefore, uint256 outBalBefore) {
    require(inTokenId != outTokenId, 'Same token');
    require(amount > 0, 'Zero amount');

    AssetInfo storage assetIn = assets[inTokenId];
    AssetInfo storage assetOut = assets[outTokenId];
    require(assetIn.contractAddress != address(0), 'Input token not found');
    require(assetOut.contractAddress != address(0), 'Output token not found');
    require(assetIn.active, 'Input token frozen');
    require(assetOut.active, 'Output token frozen');
    require(assetIn.weight > 0, 'Input weight not set');
    require(assetOut.weight > 0, 'Output weight not set');

    inBalBefore = IERC20(assetIn.contractAddress).balanceOf(address(this));
    outBalBefore = IERC20(assetOut.contractAddress).balanceOf(address(this));
    require(inBalBefore > 0, 'Zero input balance');
    require(outBalBefore > 0, 'Zero output balance');
  }

  /**
   * @dev Output amount from the Balancer invariant.
   *
   *   outBalAfter = outBalBefore * (inBalAfter / inBalBefore) ^ (-wIn / wOut)
   *               = outBalBefore / (inBalAfter / inBalBefore) ^ (wIn / wOut)
   *
   * Expressed as a division by a base-greater-than-one power so every operand
   * stays positive. The original used C `log()` and `exp()` on doubles; this uses
   * PRBMath's fixed-point `pow`, which is accurate across the whole domain.
   */
  function _computeBalancerOut(
    uint256 inBalBefore,
    uint256 inBalAfter,
    uint256 outBalBefore,
    uint256 wIn,
    uint256 wOut
  ) internal pure returns (uint256) {
    UD60x18 ratio = ud(inBalAfter).div(ud(inBalBefore));
    UD60x18 factor = ratio.pow(ud(wIn).div(ud(wOut)));

    uint256 outBalAfter = ud(outBalBefore).div(factor).unwrap();
    // Keep truncation dust in the pool rather than handing it to the trader.
    if (outBalAfter < outBalBefore) {
      outBalAfter += 1;
    }
    return outBalBefore - outBalAfter;
  }

  /**
   * @dev Input amount from the Balancer invariant.
   *
   *   inBalAfter = inBalBefore * (outBalAfter / outBalBefore) ^ (-wOut / wIn)
   *              = inBalBefore * (outBalBefore / outBalAfter) ^ (wOut / wIn)
   */
  function _computeBalancerIn(
    uint256 inBalBefore,
    uint256 outBalBefore,
    uint256 outBalAfter,
    uint256 wIn,
    uint256 wOut
  ) internal pure returns (uint256) {
    UD60x18 invRatio = ud(outBalBefore).div(ud(outBalAfter));
    UD60x18 factor = invRatio.pow(ud(wOut).div(ud(wIn)));

    uint256 inBalAfter = ud(inBalBefore).mul(factor).unwrap();
    // Charge the trader the truncation dust rather than the pool, and never
    // quote a free swap when the computed delta truncates to nothing.
    if (inBalAfter <= inBalBefore) {
      return 1;
    }
    return inBalAfter - inBalBefore + 1;
  }

  /**
   * @dev The token's own precision, so the LIQ receipt reads in the same units
   * as the deposit. Defaults to 18 for tokens that do not answer.
   *
   * Uses a raw staticcall rather than try/catch because `createAsset` accepts an
   * arbitrary address: a call that succeeds but returns undecodable data makes
   * try/catch revert in a way the catch clause cannot absorb.
   */
  function _readDecimals(address token) private view returns (uint8) {
    (bool ok, bytes memory data) = token.staticcall(
      abi.encodeWithSelector(IERC20Metadata.decimals.selector)
    );
    if (ok && data.length >= 32) {
      uint256 value = abi.decode(data, (uint256));
      if (value <= 36) {
        return uint8(value);
      }
    }
    return 18;
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
}

/**
 * @title LiquidityToken
 * @dev ERC-20 receipt for liquidity supplied to an OSwaps pool.
 *
 * Minted 1:1 against the raw amount deposited and burned 1:1 against the raw
 * amount withdrawn, so it is a nominal claim on units supplied rather than a
 * proportional share of the pool.
 *
 * Peer-to-peer transfers are blocked: every transfer must involve the pool.
 * This mirrors the original contract, which restricted LIQ transfers to
 * "to/from contract" so receipts could not be traded between accounts.
 */
contract LiquidityToken is ERC20, Ownable {
  uint8 private immutable _tokenDecimals;

  constructor(
    string memory name,
    string memory symbol,
    uint8 tokenDecimals_,
    address pool
  ) ERC20(name, symbol) Ownable(pool) {
    _tokenDecimals = tokenDecimals_;
  }

  function decimals() public view override returns (uint8) {
    return _tokenDecimals;
  }

  function mint(address to, uint256 amount) external onlyOwner {
    _mint(to, amount);
  }

  /**
   * @dev Burn without an allowance. The pool owns this token and burns receipts
   * as part of `withdraw`; the original reached the same outcome by having the
   * contract authorise the LIQ transfer itself.
   */
  function burnFrom(address from, uint256 amount) external onlyOwner {
    _burn(from, amount);
  }

  function _update(address from, address to, uint256 value) internal override {
    // Allow mint (from == 0) and burn (to == 0); block account-to-account moves.
    if (from != address(0) && to != address(0)) {
      address pool = owner();
      require(from == pool || to == pool, 'LIQ: transfers must involve pool');
    }
    super._update(from, to, value);
  }
}
