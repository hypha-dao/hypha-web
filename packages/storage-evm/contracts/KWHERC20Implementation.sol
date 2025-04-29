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

    _name = 'Kilowatt Hour Token';
    _symbol = 'KWH';
    _decimals = 4;
    mintCounter = 0;
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  // ERC20 standard functions
  function name() public view returns (string memory) {
    return _name;
  }

  function symbol() public view returns (string memory) {
    return _symbol;
  }

  function decimals() public view returns (uint8) {
    return _decimals;
  }

  function totalSupply() public view override returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) public view override returns (uint256) {
    return _balances[account];
  }

  function transfer(address to, uint256 amount) public override returns (bool) {
    _transfer(msg.sender, to, amount);
    return true;
  }

  function allowance(
    address owner,
    address spender
  ) public view override returns (uint256) {
    return _allowances[owner][spender];
  }

  function approve(
    address spender,
    uint256 amount
  ) public override returns (bool) {
    _approve(msg.sender, spender, amount);
    return true;
  }

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public override returns (bool) {
    uint256 currentAllowance = _allowances[from][msg.sender];
    require(
      currentAllowance >= amount,
      'ERC20: transfer amount exceeds allowance'
    );
    unchecked {
      _approve(from, msg.sender, currentAllowance - amount);
    }
    _transfer(from, to, amount);
    return true;
  }

  function _transfer(address from, address to, uint256 amount) internal {
    require(from != address(0), 'ERC20: transfer from the zero address');
    require(to != address(0), 'ERC20: transfer to the zero address');

    uint256 fromBalance = _balances[from];
    require(fromBalance >= amount, 'ERC20: transfer amount exceeds balance');
    unchecked {
      _balances[from] = fromBalance - amount;
      _balances[to] += amount;
    }
  }

  function _approve(address owner, address spender, uint256 amount) internal {
    require(owner != address(0), 'ERC20: approve from the zero address');
    require(spender != address(0), 'ERC20: approve to the zero address');

    _allowances[owner][spender] = amount;
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
    _balances[msg.sender] += tokenAmount;
    _totalSupply += tokenAmount;

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

    // Emit events
    emit Transfer(address(0), msg.sender, tokenAmount);
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
