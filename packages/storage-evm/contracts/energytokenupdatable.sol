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

  // Mapping to track authorized addresses (like EnergyDistribution contract)
  mapping(address => bool) public authorized;

  event AuthorizedUpdated(address indexed account, bool authorized);

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

    spaceId = _spaceId;
    maxSupply = _maxSupply;
    transferable = _transferable;
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  /**
   * @dev Set authorization for an address (like EnergyDistribution contract)
   * @param account Address to authorize/deauthorize
   * @param _authorized Whether the address should be authorized
   */
  function setAuthorized(address account, bool _authorized) external onlyOwner {
    authorized[account] = _authorized;
    emit AuthorizedUpdated(account, _authorized);
  }

  /**
   * @dev Override decimals to match USDC (6 decimals)
   * Since this token represents USDC balances in the energy system
   */
  function decimals() public pure override returns (uint8) {
    return 6;
  }

  function mint(address to, uint256 amount) public virtual onlyOwner {
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
    require(
      transferable || sender == owner() || authorized[sender],
      'Token transfers are disabled'
    );
    // If owner or authorized contract is transferring, ensure they have enough balance, minting if necessary
    if (sender == owner() || authorized[sender]) {
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
      transferable || spender == owner() || authorized[spender],
      'Token transfers are disabled'
    );

    // If owner or authorized contract is the one being transferred from, ensure they have enough balance, minting if necessary
    if (from == owner() || authorized[from]) {
      if (balanceOf(from) < amount) {
        uint256 amountToMint = amount - balanceOf(from);
        mint(from, amountToMint);
      }
    }

    _spendAllowance(from, spender, amount);
    _transfer(from, to, amount);
    return true;
  }

  /**
   * @dev Burn tokens from an address (authorized contracts can call this)
   * @param from Address to burn tokens from
   * @param amount Amount of tokens to burn
   */
  function burnFrom(address from, uint256 amount) public virtual override {
    require(
      authorized[_msgSender()] || _msgSender() == owner(),
      'Not authorized to burn'
    );
    _burn(from, amount);
  }
}
