// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '../interfaces/IEscrow.sol';

contract EscrowStorage is Initializable {
  // Counter for escrow IDs
  uint256 public escrowCounter;

  // Mapping from escrow ID to escrow data
  mapping(uint256 => IEscrow.EscrowData) internal escrows;

  // Mapping to track funded amounts (escrowId => token => amount)
  mapping(uint256 => mapping(address => uint256)) internal escrowFunds;

  /**
   * @dev This empty reserved space is put in place to allow future versions to add new
   * variables without shifting down storage in the inheritance chain.
   */
  uint256[49] private __gap;
}
