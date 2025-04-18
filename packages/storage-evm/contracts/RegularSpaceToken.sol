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

  constructor(
    string memory name,
    string memory symbol,
    address _executor,
    uint256 _spaceId,
    uint256 _maxSupply,
    bool _transferable
  ) ERC20(name, symbol) Ownable(msg.sender) {
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

  function mint(address to, uint256 amount) public virtual onlyExecutor {
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
    require(transferable, 'Token transfers are disabled');
    return super.transfer(to, amount);
  }

  // Override transferFrom function to respect transferability
  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    require(transferable, 'Token transfers are disabled');
    return super.transferFrom(from, to, amount);
  }
}
