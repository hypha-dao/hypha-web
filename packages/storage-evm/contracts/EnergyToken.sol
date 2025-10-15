// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

/**
 * @title EnergyToken
 * @dev ERC20 token representing positive cash credit balances in the energy distribution system
 * Only the EnergyDistribution contract can mint and burn tokens
 */
contract EnergyToken is ERC20, Ownable {
  // Mapping to track which addresses can mint/burn (only the EnergyDistribution contract)
  mapping(address => bool) public authorized;

  event AuthorizedUpdated(address indexed account, bool authorized);

  constructor(
    string memory name,
    string memory symbol,
    address initialOwner
  ) ERC20(name, symbol) Ownable(initialOwner) {}

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

  /**
   * @dev Mint tokens to an address (only authorized contracts)
   * @param to Address to mint tokens to
   * @param amount Amount of tokens to mint
   */
  function mint(address to, uint256 amount) external onlyAuthorized {
    _mint(to, amount);
  }

  /**
   * @dev Burn tokens from an address (only authorized contracts)
   * @param from Address to burn tokens from
   * @param amount Amount of tokens to burn
   */
  function burn(address from, uint256 amount) external onlyAuthorized {
    _burn(from, amount);
  }

  /**
   * @dev Override decimals to match USDC (6 decimals)
   * Since this token represents USDC balances, it should use the same decimals
   */
  function decimals() public pure override returns (uint8) {
    return 6;
  }

  /**
   * @dev Get the token balance of an address
   * @param account Address to check balance for
   * @return Token balance
   */
  function getBalance(address account) external view returns (uint256) {
    return balanceOf(account);
  }
}
