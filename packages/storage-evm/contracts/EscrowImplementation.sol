// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol';
import './storage/EscrowStorage.sol';
import './interfaces/IEscrow.sol';

contract EscrowImplementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  EscrowStorage,
  IEscrow
{
  using SafeERC20Upgradeable for IERC20Upgradeable;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address initialOwner) public initializer {
    __Ownable_init(initialOwner);
    __UUPSUpgradeable_init();
    escrowCounter = 0;
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  function createEscrow(
    address _partyB,
    address _tokenA,
    address _tokenB,
    uint256 _amountA,
    uint256 _amountB,
    bool _sendFundsNow
  ) external override returns (uint256) {
    require(_partyB != address(0), 'Invalid party B address');
    require(_tokenA != address(0), 'Invalid token A address');
    require(_tokenB != address(0), 'Invalid token B address');
    require(_amountA > 0, 'Amount A must be greater than 0');
    require(_amountB > 0, 'Amount B must be greater than 0');

    escrowCounter++;
    uint256 escrowId = escrowCounter;

    escrows[escrowId] = EscrowData({
      partyA: msg.sender,
      partyB: _partyB,
      tokenA: _tokenA,
      tokenB: _tokenB,
      amountA: _amountA,
      amountB: _amountB,
      isPartyAFunded: false,
      isPartyBFunded: false,
      isCompleted: false,
      isCancelled: false
    });

    emit EscrowCreated(
      escrowId,
      msg.sender,
      _partyB,
      _tokenA,
      _tokenB,
      _amountA,
      _amountB
    );

    // If sender wants to fund right away
    if (_sendFundsNow) {
      _receiveFunds(escrowId);
    }

    return escrowId;
  }

  function receiveFunds(uint256 _escrowId) external override returns (bool) {
    return _receiveFunds(_escrowId);
  }

  function _receiveFunds(uint256 _escrowId) internal returns (bool) {
    require(escrowExists(_escrowId), 'Escrow does not exist');

    EscrowData storage escrow = escrows[_escrowId];

    require(!escrow.isCompleted, 'Escrow already completed');
    require(!escrow.isCancelled, 'Escrow cancelled');

    bool isPartyA = msg.sender == escrow.partyA;
    bool isPartyB = msg.sender == escrow.partyB;

    require(isPartyA || isPartyB, 'Sender not part of this escrow');

    address tokenToTransfer;
    uint256 amountToTransfer;

    if (isPartyA && !escrow.isPartyAFunded) {
      tokenToTransfer = escrow.tokenA;
      amountToTransfer = escrow.amountA;
      escrow.isPartyAFunded = true;
    } else if (isPartyB && !escrow.isPartyBFunded) {
      tokenToTransfer = escrow.tokenB;
      amountToTransfer = escrow.amountB;
      escrow.isPartyBFunded = true;
    } else {
      revert('Party already funded or invalid state');
    }

    // Transfer tokens from sender to this contract
    IERC20Upgradeable token = IERC20Upgradeable(tokenToTransfer);
    token.safeTransferFrom(msg.sender, address(this), amountToTransfer);

    // Record the funds received
    escrowFunds[_escrowId][tokenToTransfer] += amountToTransfer;

    emit FundsReceived(
      _escrowId,
      msg.sender,
      tokenToTransfer,
      amountToTransfer
    );

    // Check if both parties have funded and complete escrow if so
    if (escrow.isPartyAFunded && escrow.isPartyBFunded) {
      _completeEscrow(_escrowId);
    }

    return true;
  }

  function _completeEscrow(uint256 _escrowId) internal {
    EscrowData storage escrow = escrows[_escrowId];

    // Mark as completed
    escrow.isCompleted = true;

    // Transfer tokens to respective parties
    IERC20Upgradeable tokenA = IERC20Upgradeable(escrow.tokenA);
    IERC20Upgradeable tokenB = IERC20Upgradeable(escrow.tokenB);

    tokenA.safeTransfer(escrow.partyB, escrow.amountA);
    tokenB.safeTransfer(escrow.partyA, escrow.amountB);

    emit EscrowCompleted(_escrowId, escrow.partyA, escrow.partyB);
  }

  function cancelEscrow(uint256 _escrowId) external override returns (bool) {
    require(escrowExists(_escrowId), 'Escrow does not exist');

    EscrowData storage escrow = escrows[_escrowId];

    require(!escrow.isCompleted, 'Escrow already completed');
    require(!escrow.isCancelled, 'Escrow already cancelled');
    require(
      msg.sender == escrow.partyA || msg.sender == escrow.partyB,
      'Not authorized'
    );

    escrow.isCancelled = true;

    emit EscrowCancelled(_escrowId, msg.sender);

    return true;
  }

  function withdrawFromCancelled(
    uint256 _escrowId
  ) external override returns (bool) {
    require(escrowExists(_escrowId), 'Escrow does not exist');

    EscrowData storage escrow = escrows[_escrowId];

    require(escrow.isCancelled, 'Escrow not cancelled');
    require(
      msg.sender == escrow.partyA || msg.sender == escrow.partyB,
      'Not authorized'
    );

    address tokenToWithdraw;
    uint256 amountToWithdraw;

    if (msg.sender == escrow.partyA && escrow.isPartyAFunded) {
      tokenToWithdraw = escrow.tokenA;
      amountToWithdraw = escrow.amountA;
      escrow.isPartyAFunded = false;
    } else if (msg.sender == escrow.partyB && escrow.isPartyBFunded) {
      tokenToWithdraw = escrow.tokenB;
      amountToWithdraw = escrow.amountB;
      escrow.isPartyBFunded = false;
    } else {
      revert('No funds to withdraw');
    }

    // Transfer tokens back to the owner
    IERC20Upgradeable token = IERC20Upgradeable(tokenToWithdraw);
    token.safeTransfer(msg.sender, amountToWithdraw);

    // Update funds record
    escrowFunds[_escrowId][tokenToWithdraw] -= amountToWithdraw;

    emit FundsWithdrawn(
      _escrowId,
      msg.sender,
      tokenToWithdraw,
      amountToWithdraw
    );

    return true;
  }

  function getEscrow(
    uint256 _escrowId
  )
    external
    view
    override
    returns (
      address partyA,
      address partyB,
      address tokenA,
      address tokenB,
      uint256 amountA,
      uint256 amountB,
      bool isPartyAFunded,
      bool isPartyBFunded,
      bool isCompleted,
      bool isCancelled
    )
  {
    require(escrowExists(_escrowId), 'Escrow does not exist');

    EscrowData storage escrow = escrows[_escrowId];

    return (
      escrow.partyA,
      escrow.partyB,
      escrow.tokenA,
      escrow.tokenB,
      escrow.amountA,
      escrow.amountB,
      escrow.isPartyAFunded,
      escrow.isPartyBFunded,
      escrow.isCompleted,
      escrow.isCancelled
    );
  }

  function escrowExists(uint256 _escrowId) public view override returns (bool) {
    return
      _escrowId > 0 &&
      _escrowId <= escrowCounter &&
      escrows[_escrowId].partyA != address(0);
  }
}
