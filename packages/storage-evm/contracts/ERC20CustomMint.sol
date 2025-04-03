// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

interface ISpaces {
  function hasToken(
    uint256 spaceId,
    address tokenAddress
  ) external view returns (bool);
}

contract SpaceToken is ERC20 {
  address public immutable executor;
  ISpaces public immutable spacesContract;
  uint256 public immutable spaceId;
  uint256 public immutable maxSupply;
  bool public immutable transferable;

  constructor(
    string memory name,
    string memory symbol,
    address _executor,
    address _spacesContract,
    uint256 _spaceId,
    uint256 _maxSupply,
    bool _transferable
  ) ERC20(name, symbol) {
    require(_executor != address(0), 'Executor cannot be zero address');
    require(
      _spacesContract != address(0),
      'Spaces contract cannot be zero address'
    );

    executor = _executor;
    spacesContract = ISpaces(_spacesContract);
    spaceId = _spaceId;
    maxSupply = _maxSupply;
    transferable = _transferable;
  }

  modifier onlyExecutor() {
    require(msg.sender == executor, 'Only executor can call this function');
    _;
  }

  function mint(address to, uint256 amount) public onlyExecutor {
    // Verify this token is registered to the space
    require(
      spacesContract.hasToken(spaceId, address(this)),
      'Token not registered to space'
    );

    // Check against maximum supply
    require(
      maxSupply == 0 || totalSupply() + amount <= maxSupply,
      'Mint would exceed maximum supply'
    );

    _mint(to, amount);
  }

  // Override transfer function to respect transferability
  function transfer(address to, uint256 amount) public override returns (bool) {
    require(transferable, 'Token transfers are disabled');
    return super.transfer(to, amount);
  }

  // Override transferFrom function to respect transferability
  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public override returns (bool) {
    require(transferable, 'Token transfers are disabled');
    return super.transferFrom(from, to, amount);
  }
}
