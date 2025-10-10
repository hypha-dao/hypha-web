// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/OwnershipTokenFactoryStorage.sol';
import './OwnershipSpaceToken.sol';
import './interfaces/IOwnershipTokenFactory.sol';
import './interfaces/IOwnershipTokenVotingPower.sol';
import './interfaces/IDAOSpaceFactory.sol';
import './interfaces/IExecutor.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';

contract OwnershipTokenFactory is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  OwnershipTokenFactoryStorage,
  IOwnershipTokenFactory
{
  address public ownershipTokenImplementation;

  event OwnershipTokenImplementationUpdated(address indexed implementation);

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address initialOwner) public initializer {
    __Ownable_init(initialOwner);
    __UUPSUpgradeable_init();
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  function setOwnershipTokenImplementation(
    address _implementation
  ) external onlyOwner {
    require(
      _implementation != address(0),
      'Implementation cannot be zero address'
    );
    ownershipTokenImplementation = _implementation;
    emit OwnershipTokenImplementationUpdated(_implementation);
  }

  function setSpacesContract(address _spacesContract) external onlyOwner {
    require(
      _spacesContract != address(0),
      'Spaces contract cannot be zero address'
    );
    spacesContract = _spacesContract;
    emit SpacesContractUpdated(_spacesContract);
  }

  function setVotingPowerContract(
    address _votingPowerContract
  ) external onlyOwner {
    require(
      _votingPowerContract != address(0),
      'Voting power contract cannot be zero address'
    );
    votingPowerContract = _votingPowerContract;
    emit VotingPowerContractUpdated(_votingPowerContract);
  }

  /**
   * @dev Deploy an ownership token (transfers only by executor between space members)
   * @param spaceId The space ID to deploy the token for
   * @param name The token name
   * @param symbol The token symbol
   * @param maxSupply The maximum token supply (0 for unlimited)
   * @param isVotingToken Whether to register this as the space's voting token
   * @return The address of the deployed token
   */
  function deployOwnershipToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply,
    bool isVotingToken
  ) public override returns (address) {
    require(spacesContract != address(0), 'Spaces contract not set');
    require(
      ownershipTokenImplementation != address(0),
      'Ownership token implementation not set'
    );

    // Strict authorization: only allow the space's executor to call this function
    address spaceExecutor = IDAOSpaceFactory(spacesContract).getSpaceExecutor(
      spaceId
    );
    require(
      msg.sender == spaceExecutor,
      'Only space executor can deploy tokens'
    );

    // Add a specific debugging event
    emit DeployingToken(spaceId, name, symbol);

    // Deploy an ownership token
    bytes memory initializeData = abi.encodeWithSelector(
      OwnershipSpaceToken.initialize.selector,
      name,
      symbol,
      spaceExecutor,
      spaceId,
      maxSupply,
      spacesContract
    );
    ERC1967Proxy proxy = new ERC1967Proxy(
      ownershipTokenImplementation,
      initializeData
    );
    address tokenAddress = address(proxy);
    isTokenDeployedByFactory[tokenAddress] = true;

    // Store the token in the array of all tokens for this space
    allSpaceTokens[spaceId].push(tokenAddress);

    // Make sure the event is using the right event signature
    emit TokenDeployed(spaceId, tokenAddress, name, symbol);

    return tokenAddress;
  }

  event DeployingToken(uint256 indexed spaceId, string name, string symbol);

  /**
   * @dev Get the token address for a given space ID
   * @param spaceId The space ID to query
   * @return The addresses of all tokens deployed for the space
   */
  function getSpaceToken(
    uint256 spaceId
  ) public view override returns (address[] memory) {
    return allSpaceTokens[spaceId];
  }
}
