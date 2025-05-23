// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IEscrow {
  // Struct to define an escrow between two parties
  struct EscrowData {
    address partyA;
    address partyB;
    address tokenA;
    address tokenB;
    uint256 amountA;
    uint256 amountB;
    bool isPartyAFunded;
    bool isPartyBFunded;
    bool isCompleted;
    bool isCancelled;
  }

  // Initialize the contract
  function initialize(address initialOwner) external;

  // Create a new escrow
  function createEscrow(
    address _partyB,
    address _tokenA,
    address _tokenB,
    uint256 _amountA,
    uint256 _amountB,
    bool _sendFundsNow
  ) external returns (uint256);

  // Receive funds from a party
  function receiveFunds(uint256 _escrowId) external returns (bool);

  // Cancel an escrow (only possible if not completed)
  function cancelEscrow(uint256 _escrowId) external returns (bool);
  
  // Withdraw funds from a cancelled escrow
  function withdrawFromCancelled(uint256 _escrowId) external returns (bool);

  // Get escrow details
  function getEscrow(uint256 _escrowId) external view returns (
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
  );

  // Check if an escrow exists
  function escrowExists(uint256 _escrowId) external view returns (bool);

  // Events
  event EscrowCreated(
    uint256 indexed escrowId,
    address indexed partyA,
    address indexed partyB,
    address tokenA,
    address tokenB,
    uint256 amountA,
    uint256 amountB
  );

  event FundsReceived(
    uint256 indexed escrowId,
    address indexed from,
    address token,
    uint256 amount
  );

  event EscrowCompleted(
    uint256 indexed escrowId,
    address indexed partyA,
    address indexed partyB
  );

  event EscrowCancelled(
    uint256 indexed escrowId,
    address cancelledBy
  );

  event FundsWithdrawn(
    uint256 indexed escrowId,
    address indexed by,
    address token,
    uint256 amount
  );
} 