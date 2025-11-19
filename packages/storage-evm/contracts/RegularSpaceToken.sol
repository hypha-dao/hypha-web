// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';

contract RegularSpaceToken is
  Initializable,
  ERC20Upgradeable,
  ERC20BurnableUpgradeable,
  OwnableUpgradeable,
  UUPSUpgradeable
{
  uint256 public spaceId;
  uint256 public maxSupply;
  bool public transferable;
  address public executor;
  address public transferHelper;

  // New configuration options
  bool public fixedMaxSupply; // If true, maxSupply cannot be changed
  bool public autoMinting; // If true, executor can mint on transfer; if false, must mint separately
  uint256 public priceInUSD; // Token price in USD (with 6 decimals, e.g., 1000000 = $1)

  // Transfer whitelists
  mapping(address => bool) public canTransfer; // Who can send tokens
  mapping(address => bool) public canReceive; // Who can receive tokens
  bool public useTransferWhitelist; // If true, enforce transfer whitelist
  bool public useReceiveWhitelist; // If true, enforce receive whitelist

  // Events
  event MaxSupplyUpdated(uint256 oldMaxSupply, uint256 newMaxSupply);
  event TransferableUpdated(bool transferable);
  event AutoMintingUpdated(bool autoMinting);
  event PriceInUSDUpdated(uint256 oldPrice, uint256 newPrice);
  event TransferWhitelistUpdated(address indexed account, bool canTransfer);
  event ReceiveWhitelistUpdated(address indexed account, bool canReceive);
  event UseTransferWhitelistUpdated(bool enabled);
  event UseReceiveWhitelistUpdated(bool enabled);
  event TokensBurned(
    address indexed burner,
    address indexed from,
    uint256 amount
  );

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    string memory name,
    string memory symbol,
    address _executor,
    uint256 _spaceId,
    uint256 _maxSupply,
    bool _transferable,
    bool _fixedMaxSupply,
    bool _autoMinting,
    uint256 _priceInUSD,
    bool _useTransferWhitelist,
    bool _useReceiveWhitelist
  ) public initializer {
    __ERC20_init(name, symbol);
    __ERC20Burnable_init();
    __Ownable_init(0x2687fe290b54d824c136Ceff2d5bD362Bc62019a);
    __UUPSUpgradeable_init();

    executor = _executor;
    spaceId = _spaceId;
    maxSupply = _maxSupply;
    transferable = _transferable;
    transferHelper = 0x479002F7602579203ffba3eE84ACC1BC5b0d6785;

    // Initialize new configuration options
    fixedMaxSupply = _fixedMaxSupply;
    autoMinting = _autoMinting;
    priceInUSD = _priceInUSD;
    useTransferWhitelist = _useTransferWhitelist;
    useReceiveWhitelist = _useReceiveWhitelist;

    // Executor is always whitelisted for both sending and receiving
    canTransfer[_executor] = true;
    canReceive[_executor] = true;
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  function mint(address to, uint256 amount) public virtual {
    require(msg.sender == executor, 'Only executor can mint');
    // Check against maximum supply
    require(
      maxSupply == 0 || totalSupply() + amount <= maxSupply,
      'Mint max supply problemchik blet'
    );

    _mint(to, amount);
  }

  // Override transfer function to respect transferability and whitelists
  function transfer(
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    address sender = _msgSender();
    require(transferable || sender == executor, 'Token transfers are disabled');

    // Executor always bypasses whitelist checks
    if (sender != executor) {
      // Check transfer whitelist
      if (useTransferWhitelist) {
        require(canTransfer[sender], 'Sender not whitelisted to transfer');
      }
    }

    // Executor can always receive tokens
    if (to != executor) {
      // Check receive whitelist
      if (useReceiveWhitelist) {
        require(canReceive[to], 'Recipient not whitelisted to receive');
      }
    }

    // If executor is transferring and auto-minting is enabled, ensure they have enough balance, minting if necessary
    if (sender == executor && autoMinting) {
      if (balanceOf(sender) < amount) {
        uint256 amountToMint = amount - balanceOf(sender);
        mint(sender, amountToMint);
      }
    }

    _transfer(sender, to, amount);
    return true;
  }

  // Override transferFrom function to respect transferability and whitelists
  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    address spender = _msgSender();
    require(
      transferable || spender == executor,
      'Token transfers are disabled'
    );

    // Executor always bypasses whitelist checks
    if (from != executor) {
      // Check transfer whitelist
      if (useTransferWhitelist) {
        require(canTransfer[from], 'Sender not whitelisted to transfer');
      }
    }

    // Executor can always receive tokens
    if (to != executor) {
      // Check receive whitelist
      if (useReceiveWhitelist) {
        require(canReceive[to], 'Recipient not whitelisted to receive');
      }
    }

    // If executor is the one being transferred from and auto-minting is enabled, ensure they have enough balance, minting if necessary
    if (from == executor && autoMinting) {
      if (balanceOf(from) < amount) {
        uint256 amountToMint = amount - balanceOf(from);
        mint(from, amountToMint);
      }
    }

    if (spender == transferHelper) {
      // Skip allowance check for TransferHelper because the helper contract ensures the user's intent.
    } else {
      _spendAllowance(from, spender, amount);
    }
    _transfer(from, to, amount);
    return true;
  }

  /**
   * @dev Update max supply (only if not fixed)
   * @param newMaxSupply The new maximum supply
   */
  function setMaxSupply(uint256 newMaxSupply) external virtual {
    require(msg.sender == executor, 'Only executor can update max supply');
    require(!fixedMaxSupply, 'Max supply is fixed and cannot be changed');
    require(
      newMaxSupply == 0 || newMaxSupply >= totalSupply(),
      'New max supply must be greater than current total supply'
    );

    uint256 oldMaxSupply = maxSupply;
    maxSupply = newMaxSupply;
    emit MaxSupplyUpdated(oldMaxSupply, newMaxSupply);
  }

  /**
   * @dev Update transferable status
   * @param _transferable Whether tokens can be transferred
   */
  function setTransferable(bool _transferable) external virtual {
    require(msg.sender == executor, 'Only executor can update transferable');
    transferable = _transferable;
    emit TransferableUpdated(_transferable);
  }

  /**
   * @dev Update auto-minting status
   * @param _autoMinting Whether auto-minting is enabled
   */
  function setAutoMinting(bool _autoMinting) external virtual {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can update auto-minting'
    );
    autoMinting = _autoMinting;
    emit AutoMintingUpdated(_autoMinting);
  }

  /**
   * @dev Update token price in USD
   * @param newPrice The new price in USD (with 6 decimals)
   */
  function setPriceInUSD(uint256 newPrice) external virtual {
    require(msg.sender == executor, 'Only executor can update price');
    uint256 oldPrice = priceInUSD;
    priceInUSD = newPrice;
    emit PriceInUSDUpdated(oldPrice, newPrice);
  }

  /**
   * @dev Batch update transfer whitelist
   * @param accounts Array of addresses to update
   * @param allowed Array of corresponding permission values
   */
  function batchSetTransferWhitelist(
    address[] calldata accounts,
    bool[] calldata allowed
  ) external virtual {
    require(msg.sender == executor, 'Only executor can update whitelist');
    require(accounts.length == allowed.length, 'Array lengths must match');

    for (uint256 i = 0; i < accounts.length; i++) {
      canTransfer[accounts[i]] = allowed[i];
      emit TransferWhitelistUpdated(accounts[i], allowed[i]);
    }
  }

  /**
   * @dev Batch update receive whitelist
   * @param accounts Array of addresses to update
   * @param allowed Array of corresponding permission values
   */
  function batchSetReceiveWhitelist(
    address[] calldata accounts,
    bool[] calldata allowed
  ) external virtual {
    require(msg.sender == executor, 'Only executor can update whitelist');
    require(accounts.length == allowed.length, 'Array lengths must match');

    for (uint256 i = 0; i < accounts.length; i++) {
      canReceive[accounts[i]] = allowed[i];
      emit ReceiveWhitelistUpdated(accounts[i], allowed[i]);
    }
  }

  /**
   * @dev Enable or disable transfer whitelist enforcement
   * @param enabled Whether to enforce transfer whitelist
   */
  function setUseTransferWhitelist(bool enabled) external virtual {
    require(
      msg.sender == executor,
      'Only executor can update whitelist settings'
    );
    useTransferWhitelist = enabled;
    emit UseTransferWhitelistUpdated(enabled);
  }

  /**
   * @dev Enable or disable receive whitelist enforcement
   * @param enabled Whether to enforce receive whitelist
   */
  function setUseReceiveWhitelist(bool enabled) external virtual {
    require(
      msg.sender == executor,
      'Only executor can update whitelist settings'
    );
    useReceiveWhitelist = enabled;
    emit UseReceiveWhitelistUpdated(enabled);
  }

  /**
   * @dev Set the transfer helper address
   * @param _transferHelper The new transfer helper address
   */
  function setTransferHelper(address _transferHelper) external virtual {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner can set transfer helper'
    );
    transferHelper = _transferHelper;
  }

  /**
   * @dev Burn tokens from any address (only executor)
   * @param from The address to burn from
   * @param amount The amount to burn
   */
  function burnFrom(address from, uint256 amount) public virtual override {
    if (msg.sender == executor) {
      // Executor can burn without approval
      _burn(from, amount);
      emit TokensBurned(msg.sender, from, amount);
    } else {
      // Others need approval
      super.burnFrom(from, amount);
      emit TokensBurned(msg.sender, from, amount);
    }
  }
}
