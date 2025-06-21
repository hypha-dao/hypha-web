// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/AgreementsStorage.sol';
import './interfaces/IAgreements.sol';
import './interfaces/IDAOSpaceFactory.sol';

contract AgreementsImplementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  AgreementsStorage,
  IAgreements
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

  // Space factory interface
  IDAOSpaceFactory public spaceFactory;

  function setContracts(address _spaceFactory) external override onlyOwner {
    require(_spaceFactory != address(0), 'Invalid space factory address');
    spaceFactory = IDAOSpaceFactory(_spaceFactory);
  }

  modifier onlySpaceExecutor(uint256 _spaceId) {
    address executor = spaceFactory.getSpaceExecutor(_spaceId);
    require(msg.sender == executor, 'Not the space executor');
    _;
  }

  function acceptAgreement(
    uint256 _spaceId,
    uint256 _proposalId
  ) external override onlySpaceExecutor(_spaceId) {
    // Ensure this proposal hasn't already been accepted for this space
    require(
      !proposalExists[_spaceId][_proposalId],
      'Agreement already accepted'
    );

    // Store the proposal ID for this space
    spaceProposals[_spaceId].push(_proposalId);

    // Mark the proposal as existing for this space
    proposalExists[_spaceId][_proposalId] = true;

    emit AgreementAccepted(_spaceId, _proposalId, msg.sender);
  }

  function getSpaceProposals(
    uint256 _spaceId
  ) external view override returns (uint256[] memory) {
    return spaceProposals[_spaceId];
  }

  function hasProposal(
    uint256 _spaceId,
    uint256 _proposalId
  ) external view override returns (bool) {
    return proposalExists[_spaceId][_proposalId];
  }
}
