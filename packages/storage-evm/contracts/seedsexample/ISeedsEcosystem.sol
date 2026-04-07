// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ISeedsEcosystem
 * @dev Interfaces for the Seeds ecosystem contracts
 */

interface IOSwaps {
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

  // Admin functions
  function init(address manager) external;

  function freeze(uint64 tokenId, string calldata symbol) external;

  function unfreeze(uint64 tokenId, string calldata symbol) external;

  // Asset management
  function createAsset(
    address tokenContract,
    string calldata symbol,
    string calldata metadata
  ) external returns (uint64 tokenId);

  function forgetAsset(uint64 tokenId) external;

  // Query
  function queryPool(
    uint64[] calldata tokenIdList
  ) external view returns (PoolStatus[] memory);

  function assets(uint64 tokenId) external view returns (AssetInfo memory);

  function config() external view returns (Config memory);

  // Liquidity
  function addLiquidity(
    uint64 tokenId,
    uint256 amount,
    uint256 weight
  ) external;

  function withdraw(
    address account,
    uint64 tokenId,
    uint256 amount,
    uint256 weight
  ) external;

  // Swaps
  function swapExactIn(
    address recipient,
    uint64 inTokenId,
    uint64 outTokenId,
    uint256 inAmount
  ) external returns (uint256 outAmount);

  function swapExactOut(
    address recipient,
    uint64 inTokenId,
    uint64 outTokenId,
    uint256 outAmount,
    uint256 maxInAmount
  ) external returns (uint256 inAmount);

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
}

interface IRainbowToken {
  struct TokenConfig {
    address issuer;
    uint256 maxSupply;
    address withdrawalMgr;
    address withdrawTo;
    address freezeMgr;
    uint256 redeemLockedUntil;
    uint256 configLockedUntil;
    bool transfersFrozen;
    bool approved;
    address membershipToken;
    address brokerToken;
    address credLimitToken;
    address posLimitToken;
    address valuationMgr;
    uint256 valPerToken;
    string refCurrency;
  }

  struct BackingInfo {
    uint64 index;
    uint256 tokenBucket;
    uint256 backsPerBucket;
    address backingTokenContract;
    address escrow;
    uint32 reserveFraction;
    bool proportional;
  }

  // Configuration
  function approve(bool approved) external;

  function setValuation(
    uint256 valPerToken,
    string calldata refCurrency
  ) external;

  function getValuation(
    uint256 amount
  ) external view returns (string memory currency, uint256 valuation);

  function setMetadata(string calldata jsonMeta) external;

  function freeze(bool frozen) external;

  function updateConfig(
    address withdrawalMgr,
    address withdrawTo,
    address freezeMgr,
    uint256 redeemLockedUntil,
    uint256 configLockedUntil,
    address membershipToken,
    address credLimitToken,
    address posLimitToken,
    address valuationMgr
  ) external;

  // Backing
  function addBacking(
    uint256 tokenBucket,
    uint256 backsPerBucket,
    address backingTokenContract,
    address escrow,
    bool proportional,
    uint32 reserveFraction
  ) external;

  function removeBacking(uint64 backingIndex) external;

  function getBackings() external view returns (BackingInfo[] memory);

  // Token operations
  function issue(uint256 amount) external;

  function retire(uint256 amount, bool doRedeem) external;

  function garner(address from, uint256 ppmPerWeek, uint256 ppmAbs) external;

  // Balance queries
  function balanceWithCredit(address account) external view returns (int256);

  // Standard ERC20
  function transfer(address to, uint256 amount) external returns (bool);

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) external returns (bool);

  function balanceOf(address account) external view returns (uint256);

  function totalSupply() external view returns (uint256);

  function approve(address spender, uint256 amount) external returns (bool);

  function allowance(
    address owner,
    address spender
  ) external view returns (uint256);

  // Events
  event TokenCreated(address indexed issuer, uint256 maxSupply);
  event TokenApproved(bool approved);
  event BackingAdded(
    uint64 indexed backingIndex,
    address indexed backingToken,
    address indexed escrow
  );
  event BackingRemoved(uint64 indexed backingIndex);
  event ValuationSet(uint256 valPerToken, string refCurrency);
  event TokenIssued(address indexed to, uint256 amount);
  event TokenRetired(address indexed from, uint256 amount, bool redeemed);
  event TokensGarnered(
    address indexed from,
    address indexed to,
    uint256 amount
  );
  event TransfersFrozen(bool frozen);
}

interface IRainbowFactory {
  function createToken(
    string memory name,
    string memory symbol,
    address issuer,
    uint256 maxSupply,
    address withdrawalMgr,
    address withdrawTo,
    address freezeMgr,
    uint256 redeemLockedUntil,
    uint256 configLockedUntil
  ) external returns (address);

  function getAllTokens() external view returns (address[] memory);

  function getTokenBySymbol(
    string memory symbol
  ) external view returns (address);

  function getTokenCount() external view returns (uint256);

  event TokenDeployed(
    address indexed tokenAddress,
    string name,
    string symbol,
    address indexed issuer,
    uint256 maxSupply
  );
}

interface ILiquidityToken {
  function mint(address to, uint256 amount) external;

  function burnFrom(address from, uint256 amount) external;

  // Standard ERC20
  function balanceOf(address account) external view returns (uint256);

  function transfer(address to, uint256 amount) external returns (bool);

  function approve(address spender, uint256 amount) external returns (bool);
}
