// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/TokenFactoryStorage.sol';
import './interfaces/ITokenFactory.sol';
import './ERC20CustomMint.sol';
import './interfaces/IDAOSpaceFactory.sol';

contract TokenFactoryImplementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  TokenFactoryStorage,
  ITokenFactory
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
    spacesContract = _spacesContract; // Store as address
    emit SpacesContractUpdated(_spacesContract);
  }

  function deployToken(
    uint256 spaceId,
    string memory name,
    string memory symbol,
    uint256 maxSupply
  ) external override returns (address) {
    require(spacesContract != address(0), 'Spaces contract not set');

    // If called by the space factory contract itself, skip additional checks
    if (msg.sender != spacesContract) {
      require(
        IDAOSpaceFactory(spacesContract).isSpaceCreator(spaceId, msg.sender) ||
          msg.sender ==
          IDAOSpaceFactory(spacesContract).getSpaceExecutor(spaceId),
        'Unauthorized: not space factory or authorized caller'
      );
    }

    address executor = IDAOSpaceFactory(spacesContract).getSpaceExecutor(
      spaceId
    );

    SpaceToken newToken = new SpaceToken(
      name,
      symbol,
      executor,
      spacesContract,
      spaceId,
      maxSupply
    );

    // Only add token to space if called by authorized party (not space factory)
    if (msg.sender != spacesContract) {
      IDAOSpaceFactory(spacesContract).addTokenToSpace(
        spaceId,
        address(newToken)
      );
    }

    emit TokenDeployed(spaceId, address(newToken), name, symbol);

    return address(newToken);
  }
}
