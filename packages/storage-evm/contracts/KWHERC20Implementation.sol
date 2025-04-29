// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import './storage/KWHERC20Storage.sol';
import './interfaces/IKWHERC20.sol';

contract KWHERC20Implementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  ERC20Upgradeable,
  KWHERC20Storage,
  IKWHERC20
{
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address initialOwner) public initializer {
    __Ownable_init(initialOwner);
    __UUPSUpgradeable_init();
    __ERC20_init('Kilowatt Hour Token', 'KWH');

    _decimals = 4;
    mintCounter = 0;
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  // Override decimals to use our custom value
  function decimals() public view virtual override returns (uint8) {
    return _decimals;
  }

  // Custom mint function that stores the mint record
  function mint(
    uint256 kwh,
    uint256 timestamp,
    address deviceId
  ) external override returns (uint256) {
    require(kwh > 0, 'Amount must be greater than 0');
    require(deviceId != address(0), 'Device ID cannot be zero address');

    // Convert KWH to token amount with 4 decimals
    uint256 tokenAmount = kwh;

    // Mint tokens to the sender
    _mint(msg.sender, tokenAmount);

    // Create and store mint record
    mintCounter++;
    uint256 newRecordId = mintCounter;

    IKWHERC20.MintRecord memory newRecord = IKWHERC20.MintRecord({
      kwh: kwh,
      timestamp: timestamp,
      deviceId: deviceId
    });

    mintRecords.push(newRecord);
    mintRecordIndexes[newRecordId] = mintRecords.length - 1;

    // Emit TokenMinted event
    emit TokenMinted(newRecordId, kwh, timestamp, deviceId, msg.sender);

    return newRecordId;
  }

  // Function to get all mint records
  function getMintRecords()
    external
    view
    override
    returns (MintRecord[] memory)
  {
    return mintRecords;
  }

  // Function to get a specific mint record by ID
  function getMintRecordById(
    uint256 recordId
  ) external view override returns (MintRecord memory) {
    require(recordId > 0 && recordId <= mintCounter, 'Invalid record ID');
    uint256 index = mintRecordIndexes[recordId];
    return mintRecords[index];
  }

  // Function to get the total count of mint records
  function getMintRecordsCount() external view override returns (uint256) {
    return mintRecords.length;
  }
}
