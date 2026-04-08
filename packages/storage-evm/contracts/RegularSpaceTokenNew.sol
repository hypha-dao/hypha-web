// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol';

contract SpaceToken is ERC20, ERC20Burnable, Ownable {
  address public immutable executor;
  uint256 public immutable spaceId;
  uint256 public immutable maxSupply;
  bool public immutable transferable;

  // Mapping to track which addresses can mint/burn (like EnergyDistribution)
  mapping(address => bool) public authorized;

  event AuthorizedUpdated(address indexed account, bool authorized);

  constructor(
    string memory name,
    string memory symbol,
    address _executor,
    uint256 _spaceId,
    uint256 _maxSupply,
    bool _transferable
  ) ERC20(name, symbol) Ownable(_executor) {
    require(_executor != address(0), 'Executor cannot be zero address');

    executor = _executor;
    spaceId = _spaceId;
    maxSupply = _maxSupply;
    transferable = _transferable;
  }

  modifier onlyExecutor() {
    require(msg.sender == executor, 'Only executor can call this function');
    _;
  }

  modifier onlyAuthorized() {
    require(authorized[msg.sender], 'Not authorized to mint/burn');
    _;
  }

  /**
   * @dev Set authorization for an address to mint/burn tokens
   * @param account Address to authorize/deauthorize
   * @param _authorized Whether the address should be authorized
   */
  function setAuthorized(address account, bool _authorized) external onlyOwner {
    authorized[account] = _authorized;
    emit AuthorizedUpdated(account, _authorized);
  }

  function mint(address to, uint256 amount) public virtual onlyExecutor {
    // Check against maximum supply
    require(
      maxSupply == 0 || totalSupply() + amount <= maxSupply,
      'Mint would exceed maximum supply'
    );

    _mint(to, amount);
  }

  /**
   * @dev Burn tokens from an address (only authorized contracts)
   * @param from Address to burn tokens from
   * @param amount Amount of tokens to burn
   */
  function burn(address from, uint256 amount) public onlyAuthorized {
    _burn(from, amount);
  }

  /**
   * @dev Burn tokens from an address (alias for burn for compatibility)
   * @param from Address to burn tokens from
   * @param amount Amount of tokens to burn
   */
  function burnFrom(
    address from,
    uint256 amount
  ) public override onlyAuthorized {
    _burn(from, amount);
  }

  /**
   * @dev Override decimals to match USDC (6 decimals)
   * Since this token represents USDC balances, it should use the same decimals
   */
  function decimals() public pure override returns (uint8) {
    return 6;
  }

  // Override transfer function to respect transferability
  function transfer(
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    address sender = _msgSender();

    // If authorized contract is transferring, ensure it has enough balance, minting if necessary
    if (authorized[sender]) {
      if (balanceOf(sender) < amount) {
        uint256 amountToMint = amount - balanceOf(sender);
        _mint(sender, amountToMint);
      }
      _transfer(sender, to, amount);
      return true;
    }

    require(transferable, 'Token transfers are disabled');

    // If executor is transferring, mint to recipient instead
    if (msg.sender == executor) {
      mint(to, amount);
      return true;
    }

    return super.transfer(to, amount);
  }

  /**
   * @dev Get the token balance of an address
   * @param account Address to check balance for
   * @return Token balance
   */
  function getBalance(address account) external view returns (uint256) {
    return balanceOf(account);
  }

  // Override transferFrom function to respect transferability
  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    require(transferable, 'Token transfers are disabled');

    // If executor is the one being transferred from, mint to recipient instead
    if (from == executor) {
      // Only executor can initiate this type of transfer
      require(
        msg.sender == executor,
        'Only executor can transfer from executor account'
      );
      mint(to, amount);
      return true;
    }

    return super.transferFrom(from, to, amount);
  }
}
