// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/RegularTokenVotingPowerStorage.sol';
import './interfaces/IRegularTokenVotingPower.sol';
import './interfaces/IDAOSpaceFactory.sol';

/**
 * @title TokenVotingPower
 * @dev Manages voting power calculations based on ERC20 token holdings
 */
contract TokenVotingPowerImplementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  RegularTokenVotingPowerStorage,
  IRegularTokenVotingPower
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

  /**
   * @dev Set the address of the token factory that can call setSpaceToken
   * @param _tokenFactory Address of the authorized token factory
   */
  function setTokenFactory(address _tokenFactory) external onlyOwner {
    require(
      _tokenFactory != address(0),
      'Token factory cannot be zero address'
    );
    tokenFactory = _tokenFactory;
    emit TokenFactorySet(_tokenFactory);
  }

  /**
   * @dev Set the address of the space factory to check executor permissions
   * @param _spaceFactory Address of the space factory contract
   */
  function setSpaceFactory(address _spaceFactory) external onlyOwner {
    require(
      _spaceFactory != address(0),
      'Space factory cannot be zero address'
    );
    spaceFactory = _spaceFactory;
    emit SpaceFactorySet(_spaceFactory);
  }

  /**
   * @dev Link a space with its voting token - can only be set by the space's executor
   * @param _spaceId The space ID to link
   * @param _tokenAddress The ERC20 token address to use for voting power
   */
  function setSpaceToken(
    uint256 _spaceId,
    address _tokenAddress
  ) external override {
    require(_spaceId > 0, 'Invalid space ID');
    require(_tokenAddress != address(0), 'Invalid token address');
    require(spaceFactory != address(0), 'Space factory not set');

    // Check that the caller is the space's executor
    address spaceExecutor = IDAOSpaceFactory(spaceFactory).getSpaceExecutor(
      _spaceId
    );
    require(
      msg.sender == spaceExecutor,
      'Only space executor can set space token'
    );

    spaceTokens[_spaceId] = _tokenAddress;
    emit SpaceTokenSet(_spaceId, _tokenAddress);
  }

  /**
   * @dev Get voting power for a user from a specific space based on token holdings
   * @param _user The address to check voting power for
   * @param _sourceSpaceId The space ID from which to derive voting power
   * @return The voting power (token balance of the user)
   */
  function getVotingPower(
    address _user,
    uint256 _sourceSpaceId
  ) external view override returns (uint256) {
    require(_sourceSpaceId > 0, 'Invalid space ID');
    address tokenAddress = spaceTokens[_sourceSpaceId];
    require(tokenAddress != address(0), 'Token not set for space');

    return IERC20(tokenAddress).balanceOf(_user);
  }

  /**
   * @dev Get total voting power from a specific space
   * @param _sourceSpaceId The space ID from which to derive total voting power
   * @return The total voting power (total supply of the token)
   */
  function getTotalVotingPower(
    uint256 _sourceSpaceId
  ) external view override returns (uint256) {
    require(_sourceSpaceId > 0, 'Invalid space ID');
    address tokenAddress = spaceTokens[_sourceSpaceId];
    require(tokenAddress != address(0), 'Token not set for space');

    return IERC20(tokenAddress).totalSupply();
  }
}
