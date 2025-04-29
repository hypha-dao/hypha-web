// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '../interfaces/IKWHERC20.sol';

contract KWHERC20Storage is Initializable {
  // ERC20 standard storage
  string internal _name;
  string internal _symbol;
  uint8 internal _decimals;
  uint256 internal _totalSupply;
  mapping(address => uint256) internal _balances;
  mapping(address => mapping(address => uint256)) internal _allowances;

  // KWH specific storage
  uint256 public mintCounter;

  // Array to store all mint records
  IKWHERC20.MintRecord[] internal mintRecords;

  // Mapping from record ID to array index for faster lookups
  mapping(uint256 => uint256) internal mintRecordIndexes;

  /**
   * @dev This empty reserved space is put in place to allow future versions to add new
   * variables without shifting down storage in the inheritance chain.
   */
  uint256[48] private __gap;
}
