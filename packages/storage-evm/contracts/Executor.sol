// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './interfaces/IExecutor.sol';

contract Executor is IExecutor {
  address public owner;
  address public proposalManager;

  //event TransactionExecuted(address target, uint value, bytes data);
  //event BatchTransactionsExecuted(Transaction[] transactions);

  constructor(address _proposalManager) {
    owner = msg.sender;
    //require(_proposalManager != address(0), "Invalid proposal manager address");
    proposalManager = _proposalManager;
  }

  modifier onlyOwner() {
    require(msg.sender == owner, 'Na');
    _;
  }

  function setProposalManager(address _proposalManager) external onlyOwner {
    proposalManager = _proposalManager;
  }

  modifier onlyProposalManagerOrSelf() {
    require(msg.sender == proposalManager || msg.sender == address(this), 'Na');
    _;
  }

/*
  function executeTransaction(
    address target,
    uint256 value,
    bytes memory data
  ) external override onlyProposalManagerOrSelf returns (bool success) {
    require(address(this).balance >= value, 'ins bal');
    (success, ) = target.call{value: value}(data);
    require(success, 'f');
    //emit TransactionExecuted(target, value, data);
    return success;
  }
*/

  function executeTransactions(
    Transaction[] calldata transactions
  ) external override onlyProposalManagerOrSelf returns (bool) {
    for (uint i = 0; i < transactions.length; i++) {
      Transaction memory txn = transactions[i];
      require(address(this).balance >= txn.value, 'ins bal');
      (bool success, ) = txn.target.call{value: txn.value}(txn.data);
      require(success, 'There was an error executing the transaction. Please check that you have sufficient funds in the treasury for this proposal and try again.');
    }

    //emit BatchTransactionsExecuted(transactions);
    return true;
  }

  receive() external payable {}
}
