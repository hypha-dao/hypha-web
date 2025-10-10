// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';

contract SpaceTokenV2 is
  Initializable,
  ERC20Upgradeable,
  ERC20BurnableUpgradeable,
  OwnableUpgradeable,
  UUPSUpgradeable
{
  uint256 public spaceId;
  uint256 public maxSupply;
  bool public transferable;
  uint256 public extraFeature; // New V2 state variable

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
    bool _transferable
  ) public initializer {
    __ERC20_init(name, symbol);
    __ERC20Burnable_init();
    __Ownable_init(_executor);
    __UUPSUpgradeable_init();

    require(_executor != address(0), 'Executor cannot be zero address');

    spaceId = _spaceId;
    maxSupply = _maxSupply;
    transferable = _transferable;
  }

  // V2 initializer
  function initializeV2(uint256 _extraFeature) public reinitializer(2) {
    extraFeature = _extraFeature;
  }

  function version() public pure returns (string memory) {
    return 'V2';
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  function mint(address to, uint256 amount) public virtual onlyOwner {
    // Check against maximum supply
    require(
      maxSupply == 0 || totalSupply() + amount <= maxSupply,
      'Mint would exceed maximum supply'
    );

    _mint(to, amount);
  }

  // Override transfer function to respect transferability
  function transfer(
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    address sender = _msgSender();
    require(transferable || sender == owner(), 'Token transfers are disabled');

    // If executor is transferring, ensure they have enough balance, minting if necessary
    if (sender == owner()) {
      if (balanceOf(sender) < amount) {
        uint256 amountToMint = amount - balanceOf(sender);
        mint(sender, amountToMint);
      }
    }

    _transfer(sender, to, amount);
    return true;
  }

  // Override transferFrom function to respect transferability
  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    address spender = _msgSender();
    require(transferable || spender == owner(), 'Token transfers are disabled');

    // If executor is the one being transferred from, ensure they have enough balance, minting if necessary
    if (from == owner()) {
      if (balanceOf(from) < amount) {
        uint256 amountToMint = amount - balanceOf(from);
        mint(from, amountToMint);
      }
    }

    _spendAllowance(from, spender, amount);
    _transfer(from, to, amount);
    return true;
  }
}
