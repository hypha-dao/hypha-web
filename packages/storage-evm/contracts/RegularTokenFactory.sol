// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/RegularTokenFactoryStorage.sol';
import './RegularSpaceToken.sol';
import './interfaces/IRegularTokenFactory.sol';
import './interfaces/IRegularTokenVotingPower.sol';
import './interfaces/IDAOSpaceFactory.sol';
import './interfaces/IExecutor.sol';

contract RegularTokenFactory is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  RegularTokenFactoryStorage,
  IRegularTokenFactory
{
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
   * @dev Deploy a regular token (without decay)
   * @param spaceId The space ID to deploy the token for
   * @param name The token name
   * @param symbol The token symbol
   * @param maxSupply The maximum token supply (0 for unlimited)
   * @param transferable Whether the token can be transferred
   * @param isVotingToken Whether to register this as the space's voting token
   * @return The address of the deployed token
   */
  function deployToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply,
    bool transferable,
    bool isVotingToken
  ) public override returns (address) {
    require(spacesContract != address(0), 'Spaces contract not set');

    // If isVotingToken is true, ensure a voting power contract is set
    if (isVotingToken) {
      require(
        votingPowerContract != address(0),
        'Voting power contract not set'
      );
    }

    // Strict authorization: only allow the space's executor to call this function
    address spaceExecutor = IDAOSpaceFactory(spacesContract).getSpaceExecutor(
      spaceId
    );
    require(
      msg.sender == spaceExecutor,
      'Only space executor can deploy tokens'
    );

    // Deploy a regular token
    SpaceToken newToken = new SpaceToken(
      name,
      symbol,
      spaceExecutor,
      spaceId,
      maxSupply,
      transferable
    );
    address tokenAddress = address(newToken);
    isTokenDeployedByFactory[tokenAddress] = true;

    emit TokenDeployed(spaceId, tokenAddress, name, symbol);

    // Register as voting token if requested
    if (isVotingToken) {
      IRegularTokenVotingPower(votingPowerContract).setSpaceToken(
        spaceId,
        tokenAddress
      );
      emit VotingTokenSet(spaceId, tokenAddress);
    }

    return tokenAddress;
  }
}
