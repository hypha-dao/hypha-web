// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './RegularSpaceToken.sol';
import './interfaces/IDAOSpaceFactory.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';

/**
 * @dev Interface for querying escrow creator
 */
interface IEscrowCreatorQuery {
  function getEscrowCreator(uint256 _escrowId) external view returns (address);

  function escrowExists(uint256 _escrowId) external view returns (bool);
}

/**
 * @title OwnershipSpaceToken
 * @dev A space token that can only be transferred between space members and only by the executor
 * Special exceptions are made for escrow contract interactions
 */
contract OwnershipSpaceToken is Initializable, RegularSpaceToken {
  address public spacesContract;

  // Hardcoded escrow contract address
  address public constant escrowContract =
    0x447A317cA5516933264Cdd6aeee0633Fa954B576; // TODO: Replace with actual escrow contract address

  /**
   * @dev Emitted when a transfer is rejected due to membership requirements
   */
  event TransferRejected(address from, address to, string reason);

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
    address _spacesContract
  ) public initializer {
    RegularSpaceToken.initialize(
      name,
      symbol,
      _executor,
      _spaceId,
      _maxSupply,
      true
    );
    require(
      _spacesContract != address(0),
      'Spaces contract cannot be zero address'
    );
    spacesContract = _spacesContract;
  }

  /**
   * @dev Override transfer function to enforce space membership restrictions
   * Allows space members to transfer to escrow contract only if the escrow was created by the space executor
   * Only the executor can initiate other transfers between space members
   */
  function transfer(address to, uint256 amount) public override returns (bool) {
    address sender = _msgSender();
    if (sender == executor) {
      if (balanceOf(sender) < amount) {
        uint256 amountToMint = amount - balanceOf(sender);
        mint(sender, amountToMint);
      }
    }
    // If executor is transferring, mint to recipient instead

    // Allow space members to transfer to escrow contract if it was created by the executor
    if (to == escrowContract && _isSpaceMember(sender)) {
      // Get the escrow ID from the transfer context (this would need to be passed as a parameter in a real implementation)
      // For now, we'll add a transferToEscrow function that takes the escrow ID as parameter
      revert('Use transferToEscrow function for escrow transfers');
    }

    // Only executor can initiate other transfers
    require(sender == executor, 'Only executor can transfer tokens');

    // Check that recipient is a member of the space
    require(_isSpaceMember(to), 'Can only transfer to space members');

    // Execute the transfer using the parent implementation
    _transfer(sender, to, amount);
    return true;
  }

  /**
   * @dev Transfer tokens to a specific escrow
   * Only allows transfer if the escrow was created by the space executor
   */
  function transferToEscrow(
    uint256 escrowId,
    uint256 amount
  ) external returns (bool) {
    require(
      _isSpaceMember(msg.sender),
      'Only space members can transfer to escrow'
    );

    IEscrowCreatorQuery escrowQuery = IEscrowCreatorQuery(escrowContract);

    // Check if escrow exists
    require(escrowQuery.escrowExists(escrowId), 'Escrow does not exist');

    // Check if escrow was created by the space executor
    address escrowCreator = escrowQuery.getEscrowCreator(escrowId);
    require(
      escrowCreator == executor,
      'Escrow must be created by space executor'
    );

    // Execute the transfer using the parent implementation
    _transfer(msg.sender, escrowContract, amount);
    return true;
  }

  /**
   * @dev Override transferFrom function to enforce space membership restrictions
   * Allows escrow contract to transfer to space members
   * Only the executor can initiate other transfers between space members
   */
  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public override returns (bool) {
    address spender = _msgSender();
    if (from == executor) {
      if (balanceOf(from) < amount) {
        uint256 amountToMint = amount - balanceOf(from);
        mint(from, amountToMint);
      }
    }
    // Allow escrow contract to transfer to space members
    if (spender == escrowContract && _isSpaceMember(to)) {
      _transfer(from, to, amount);
      return true;
    }

    if (spender == transferHelper) {
      require(_isSpaceMember(to), 'Can only transfer to space members');
      _transfer(from, to, amount);
      return true;
    }

    // Only executor can initiate other transfers
    require(spender == executor, 'Only executor can transfer tokens');

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
   * @dev Override mint to ensure tokens can only be minted to space members or the executor
   */
  function mint(address to, uint256 amount) public override {
    require(msg.sender == executor, 'Only executor can mint');
    require(
      _isSpaceMember(to) || to == executor,
      'Can only mint to space members or executor'
    );
    super.mint(to, amount);
  }
}
