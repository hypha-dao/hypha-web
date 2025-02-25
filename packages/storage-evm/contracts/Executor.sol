// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Executor {
    address public owner;
    address public proposalManager;
    
    event TransactionExecuted(address target, uint value, bytes data);
    
    constructor(address _proposalManager) {
        owner = msg.sender;
        require(_proposalManager != address(0), "Invalid proposal manager address");
        proposalManager = _proposalManager;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }
    
    function setProposalManager(address _proposalManager) external onlyOwner {
        proposalManager = _proposalManager;
    }
    
    modifier onlyProposalManager() {
        require(msg.sender == proposalManager, "Only ProposalManager can execute");
        _;
    }
    
    function executeTransaction(
        address target,
        uint256 value,
        bytes memory data
    ) external onlyProposalManager returns (bool success) {
        require(address(this).balance >= value, "Insufficient balance");
        (success, ) = target.call{value: value}(data);
        require(success, "Transaction failed");
        emit TransactionExecuted(target, value, data);
        return success;
    }
    
    receive() external payable {}
}