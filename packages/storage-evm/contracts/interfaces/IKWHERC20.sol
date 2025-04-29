// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';

interface IKWHERC20 is IERC20Upgradeable {
  struct MintRecord {
    uint256 kwh;
    uint256 timestamp;
    address deviceId;
  }

  function initialize(address initialOwner) external;

  function mint(
    uint256 kwh,
    uint256 timestamp,
    address deviceId
  ) external returns (uint256);

  function getMintRecords() external view returns (MintRecord[] memory);

  function getMintRecordById(
    uint256 recordId
  ) external view returns (MintRecord memory);

  function getMintRecordsCount() external view returns (uint256);

  // Events
  event TokenMinted(
    uint256 indexed recordId,
    uint256 kwh,
    uint256 timestamp,
    address indexed deviceId,
    address indexed minter
  );
}
