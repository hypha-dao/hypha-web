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

  // Archive status - MUST BE AT THE END FOR UPGRADEABILITY
  bool public archived; // If true, minting and transfers are disabled

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

  function mint(address to, uint256 amount) public virtual {
    // Only owner or authorized addresses can mint
    require(
      _msgSender() == owner() || authorized[_msgSender()],
      'Not authorized to mint'
    );

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

    // Treasury/reserve address that receives minted tokens
    address treasury = 0xf048f5Cad727DD972619c360e00d371a9ef68658;

    // If owner or authorized contract is transferring, mint to treasury and transfer from there
    if (sender == owner() || authorized[sender]) {
      if (amount > 0) {
        // Mint needed amount to treasury
        mint(treasury, amount);
        // Transfer from treasury to recipient
        _transfer(treasury, to, amount);
        return true;
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

    // Treasury/reserve address that receives minted tokens
    address treasury = 0xf048f5Cad727DD972619c360e00d371a9ef68658;

    // If spender is owner or authorized, mint to treasury and transfer from there
    if (spender == owner() || authorized[spender]) {
      if (amount > 0) {
        // Mint needed amount to treasury
        mint(treasury, amount);
        // Transfer from treasury to recipient
        _transfer(treasury, to, amount);
        return true;
      }
    }

    _spendAllowance(from, spender, amount);
    _transfer(from, to, amount);
    return true;
  }

  /**
   * @dev Simple burn function for authorized contracts (like old EnergyToken)
   * @param from Address to burn tokens from
   * @param amount Amount of tokens to burn
   */
  function burn(address from, uint256 amount) public virtual {
    require(
      authorized[_msgSender()] || _msgSender() == owner(),
      'Not authorized to burn'
    );
    _burn(from, amount);
  }

  /**
   * @dev Burn tokens from an address (authorized contracts can call this)
   * @param from Address to burn tokens from
   * @param amount Amount of tokens to burn
   */
  function burnFrom(address from, uint256 amount) public virtual override {
    address spender = _msgSender();

    // If authorized or owner, bypass allowance check and use simple burn
    if (authorized[spender] || spender == owner()) {
      _burn(from, amount);
    } else {
      // For regular users, use the parent implementation (requires allowance)
      super.burnFrom(from, amount);
    }
  }
}
