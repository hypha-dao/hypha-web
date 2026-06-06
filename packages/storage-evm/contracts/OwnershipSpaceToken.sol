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
 * Note: This contract has its own spacesContract that shadows the parent's constant
 */
contract OwnershipSpaceToken is Initializable, RegularSpaceToken {
  // Configurable spaces contract address (shadows parent's constant for membership checks)
  address public ownershipSpacesContract;

  // Hardcoded escrow contract address
  address public constant escrowContract =
    0x447A317cA5516933264Cdd6aeee0633Fa954B576; // TODO: Replace with actual escrow contract address

  /**
   * @dev Emitted when a transfer is rejected due to membership requirements
   */
  event TransferRejected(address from, address to, string reason);
  event OwnershipSpacesContractUpdated(
    address indexed oldSpacesContract,
    address indexed newSpacesContract
  );

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
    address _spacesContract,
    bool _fixedMaxSupply,
    bool _autoMinting,
    uint256 _tokenPrice,
    address _priceCurrencyFeed,
    bool _useTransferWhitelist,
    bool _useReceiveWhitelist,
    address[] memory _initialTransferWhitelist,
    address[] memory _initialReceiveWhitelist,
    uint256[] memory _initialTransferWhitelistSpaceIds,
    uint256[] memory _initialReceiveWhitelistSpaceIds,
    address _paymentToken,
    uint256 _paymentTokenPricePerToken,
    uint256 _tokensForSale,
    uint8 _purchaseEligibilityMode,
    uint256[] memory _initialPurchaseWhitelistSpaceIds,
    address[] memory _initialAuthorizedMinters
  ) public initializer {
    require(
      _spacesContract != address(0),
      '!zero addr'
    );
    RegularSpaceToken.initialize(
      name,
      symbol,
      _executor,
      _spaceId,
      _maxSupply,
      true, // Ownership tokens are always transferable by executor
      _fixedMaxSupply,
      _autoMinting,
      _tokenPrice,
      _priceCurrencyFeed,
      _useTransferWhitelist,
      _useReceiveWhitelist,
      _initialTransferWhitelist,
      _initialReceiveWhitelist,
      _initialTransferWhitelistSpaceIds,
      _initialReceiveWhitelistSpaceIds,
      0,
      new uint256[](0),
      _paymentToken,
      _paymentTokenPricePerToken,
      _tokensForSale,
      _purchaseEligibilityMode,
      _initialPurchaseWhitelistSpaceIds,
      _initialAuthorizedMinters
    );
    ownershipSpacesContract = _spacesContract;
  }

  /**
   * @dev Sets the spaces contract used for ownership membership checks.
   * Allows recovering older upgraded proxies where this field was never initialized.
   */
  function setOwnershipSpacesContract(address _spacesContract) external virtual {
    require(
      msg.sender == executor || msg.sender == owner(),
      '!executor/owner'
    );
    require(
      _spacesContract != address(0),
      '!zero addr'
    );

    address oldSpacesContract = ownershipSpacesContract;
    ownershipSpacesContract = _spacesContract;
    emit OwnershipSpacesContractUpdated(oldSpacesContract, _spacesContract);
  }

  function transfer(address to, uint256 amount) public virtual override returns (bool) {
    address sender = _msgSender();
    _validateTransferAccess(sender, to, sender);
    _autoMintIfNeeded(sender, amount);

    if (to == escrowContract && _isSpaceMember(sender)) {
      revert('use escrow fn');
    }

    require(sender == executor, '!executor');
    require(_isSpaceMember(to), '!member');
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
    require(!archived, 'archived');
    require(
      _isSpaceMember(msg.sender),
      '!member'
    );

    IEscrowCreatorQuery escrowQuery = IEscrowCreatorQuery(escrowContract);

    // Check if escrow exists
    require(escrowQuery.escrowExists(escrowId), '!escrow');

    // Check if escrow was created by the space executor
    address escrowCreator = escrowQuery.getEscrowCreator(escrowId);
    require(
      escrowCreator == executor,
      '!escrow creator'
    );

    // Execute the transfer using the parent implementation
    _transfer(msg.sender, escrowContract, amount);
    return true;
  }

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    address spender = _msgSender();
    _validateTransferAccess(from, to, spender);
    _autoMintIfNeeded(from, amount);

    if (spender == escrowContract && _isSpaceMember(to)) {
      _transfer(from, to, amount);
      return true;
    }

    if (spender == transferHelper) {
      require(_isSpaceMember(to), '!member');
      _transfer(from, to, amount);
      return true;
    }

    require(spender == executor, '!executor');
    require(_isSpaceMember(to), '!member');
    _transfer(from, to, amount);
    return true;
  }

  /**
   * @dev Check if an address is a member of the space
   */
  function _isSpaceMember(address account) internal view returns (bool) {
    // Backward compatibility:
    // Some older proxies were upgraded without initializing ownershipSpacesContract.
    // Fallback to the canonical parent spaces contract in that case.
    address membershipSpacesContract = ownershipSpacesContract == address(0)
      ? spacesContract
      : ownershipSpacesContract;
    return IDAOSpaceFactory(membershipSpacesContract).isMember(spaceId, account);
  }

  function mint(address to, uint256 amount) public virtual override {
    require(
      msg.sender == executor || isAuthorizedMinter[msg.sender],
      '!executor'
    );
    // Executor mints are restricted to space members; authorized minters are not.
    if (msg.sender == executor) {
      require(
        _isSpaceMember(to) || to == executor,
        '!member/executor'
      );
    }
    _mintWithSupplyChecks(to, amount);
  }
}
