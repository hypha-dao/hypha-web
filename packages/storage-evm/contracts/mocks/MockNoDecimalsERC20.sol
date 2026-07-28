// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @dev Minimal ERC20-like token that deliberately does NOT implement
 *      `decimals()`. Used to verify that callers reading token metadata degrade
 *      gracefully instead of reverting.
 */
contract MockNoDecimalsERC20 {
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;
  uint256 public totalSupply;

  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);

  function mint(address to, uint256 amount) external {
    balanceOf[to] += amount;
    totalSupply += amount;
    emit Transfer(address(0), to, amount);
  }

  function approve(address spender, uint256 amount) external returns (bool) {
    allowance[msg.sender][spender] = amount;
    emit Approval(msg.sender, spender, amount);
    return true;
  }

  function transfer(address to, uint256 amount) external returns (bool) {
    _transfer(msg.sender, to, amount);
    return true;
  }

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) external returns (bool) {
    uint256 allowed = allowance[from][msg.sender];
    require(allowed >= amount, 'insufficient allowance');
    if (allowed != type(uint256).max) {
      allowance[from][msg.sender] = allowed - amount;
    }
    _transfer(from, to, amount);
    return true;
  }

  function _transfer(address from, address to, uint256 amount) private {
    require(balanceOf[from] >= amount, 'insufficient balance');
    balanceOf[from] -= amount;
    balanceOf[to] += amount;
    emit Transfer(from, to, amount);
  }
}
