// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './RegularSpaceToken.sol';
import './interfaces/IDAOSpaceFactory.sol';

/**
 * @title OwnershipSpaceToken
 * @dev A space token that can only be transferred between space members and only by the executor
 */
contract OwnershipSpaceToken is SpaceToken {
  address public immutable spacesContract;

  /**
   * @dev Emitted when a transfer is rejected due to membership requirements
   */
  event TransferRejected(address from, address to, string reason);

  constructor(
    string memory name,
    string memory symbol,
    address _executor,
    uint256 _spaceId,
    uint256 _maxSupply,
    address _spacesContract
  ) SpaceToken(name, symbol, _executor, _spaceId, _maxSupply, true) {
    require(
      _spacesContract != address(0),
      'Spaces contract cannot be zero address'
    );
    spacesContract = _spacesContract;
  }

  /**
   * @dev Override transfer function to enforce space membership restrictions
   * Only the executor can initiate transfers and only between space members
   */
  function transfer(address to, uint256 amount) public override returns (bool) {
    // Only executor can initiate transfers
    require(msg.sender == executor, 'Only executor can transfer tokens');

    // Check that recipient is a member of the space
    require(_isSpaceMember(to), 'Can only transfer to space members');

    // Execute the transfer using the parent implementation
    return super.transfer(to, amount);
  }

  /**
   * @dev Override transferFrom function to enforce space membership restrictions
   * Only the executor can initiate transfers and only between space members
   */
  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public override returns (bool) {
    // Only executor can initiate transfers
    require(msg.sender == executor, 'Only executor can transfer tokens');

    // Check that recipient is a member of the space
    require(_isSpaceMember(to), 'Can only transfer to space members');

    // Bypass allowance check when executor is transferring
    _transfer(from, to, amount);
    return true;
  }

  /**
   * @dev Check if an address is a member of the space
   */
  function _isSpaceMember(address account) internal view returns (bool) {
    return IDAOSpaceFactory(spacesContract).isMember(spaceId, account);
  }

  /**
   * @dev Override mint to ensure tokens can only be minted to space members
   */
  function mint(address to, uint256 amount) public override onlyExecutor {
    require(_isSpaceMember(to), 'Can only mint to space members');
    super.mint(to, amount);
  }
}
