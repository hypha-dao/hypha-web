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
    __Ownable_init(0x2687fe290b54d824c136Ceff2d5bD362Bc62019a);
    __UUPSUpgradeable_init();

    executor = _executor;
    spaceId = _spaceId;
    maxSupply = _maxSupply;
    transferable = _transferable;
    transferHelper = 0x479002F7602579203ffba3eE84ACC1BC5b0d6785;
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

  // Override transfer function to respect transferability
  function transfer(
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    address sender = _msgSender();
    require(transferable || sender == executor, 'Token transfers are disabled');
    // If executor is transferring, ensure they have enough balance, minting if necessary
    if (sender == executor) {
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
    require(
      transferable || spender == executor,
      'Token transfers are disabled'
    );

    // If executor is the one being transferred from, ensure they have enough balance, minting if necessary
    if (from == executor) {
      if (balanceOf(from) < amount) {
        uint256 amountToMint = amount - balanceOf(from);
        mint(from, amountToMint);
      }
    }

    if (spender == transferHelper && tx.origin == from) {
      // Skip allowance check for TransferHelper if tx is initiated by token owner
    } else {
      _spendAllowance(from, spender, amount);
    }
    _transfer(from, to, amount);
    return true;
  }
}
