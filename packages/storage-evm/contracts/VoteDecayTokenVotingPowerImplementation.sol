// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import './storage/DecayTokenVotingPowerStorage.sol';
import './interfaces/IDecayTokenVotingPower.sol';
import './interfaces/IDecayingSpaceToken.sol';
import './interfaces/IDAOSpaceFactory.sol';

/**
 * @title VoteDecayTokenVotingPowerImplementation
 * @dev Manages voting power calculations based on decaying token holdings with delegation support
 */
contract VoteDecayTokenVotingPowerImplementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  ReentrancyGuardUpgradeable,
  DecayTokenVotingPowerStorage,
  IDecayTokenVotingPower
{
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address initialOwner) public initializer {
    __Ownable_init(initialOwner);
    __UUPSUpgradeable_init();
    __ReentrancyGuard_init();
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  /**
   * @dev Set the delegation contract address
   * @param _delegationContract Address of the delegation contract
   */
  function setDelegationContract(
    address _delegationContract
  ) external onlyOwner {
    require(
      _delegationContract != address(0),
      'Delegation contract cannot be zero address'
    );
    delegationContract = IVotingPowerDelegation(_delegationContract);
    emit DelegationContractSet(_delegationContract);
  }

  /**
   * @dev Set the address of the decaying token factory that can call setSpaceToken
   * @param _decayTokenFactory Address of the authorized decaying token factory
   */
  function setDecayTokenFactory(address _decayTokenFactory) external onlyOwner {
    require(_decayTokenFactory != address(0), 'Invalid token factory address');
    decayTokenFactory = _decayTokenFactory;
    emit DecayTokenFactorySet(_decayTokenFactory);
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
   * @param _tokenAddress The DecayingSpaceToken address to use for voting power
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

    // Validate that it's a DecayingSpaceToken by checking if it has decay properties
    try IDecayingSpaceToken(_tokenAddress).decayPercentage() returns (uint256) {
      // It's a valid DecayingSpaceToken
      spaceTokens[_spaceId] = _tokenAddress;
      emit SpaceTokenSet(_spaceId, _tokenAddress);
    } catch {
      revert('Token must be a DecayingSpaceToken');
    }
  }

  /**
   * @dev Get voting power for a user from a specific space based on decayed token holdings (including delegated power)
   * @param _user The address to check voting power for
   * @param _sourceSpaceId The space ID from which to derive voting power
   * @return The voting power (decayed token balance of the user + delegated balances from space members only)
   */
  function getVotingPower(
    address _user,
    uint256 _sourceSpaceId
  ) external view override returns (uint256) {
    uint256 totalPower = 0;

    // Add user's own power if not delegated or no delegation contract set
    if (
      address(delegationContract) == address(0) ||
      !delegationContract.hasDelegated(_user, _sourceSpaceId)
    ) {
      totalPower += _getOwnVotingPower(_user, _sourceSpaceId);
    }

    // Add delegated power if delegation contract is set (only from space members)
    if (address(delegationContract) != address(0)) {
      address[] memory delegators = delegationContract.getDelegators(
        _user,
        _sourceSpaceId
      );
      for (uint256 i = 0; i < delegators.length; i++) {
        // Only count delegated power from space members
        if (
          spaceFactory != address(0) &&
          IDAOSpaceFactory(spaceFactory).isMember(_sourceSpaceId, delegators[i])
        ) {
          totalPower += _getOwnVotingPower(delegators[i], _sourceSpaceId);
        }
      }
    }

    return totalPower;
  }

  /**
   * @dev Get only the user's own voting power (without delegation)
   * @param _user The address to check voting power for
   * @param _sourceSpaceId The space ID from which to derive voting power
   * @return The user's own voting power
   */
  function getOwnVotingPower(
    address _user,
    uint256 _sourceSpaceId
  ) external view returns (uint256) {
    return _getOwnVotingPower(_user, _sourceSpaceId);
  }

  /**
   * @dev Internal function to get user's own voting power
   */
  function _getOwnVotingPower(
    address _user,
    uint256 _sourceSpaceId
  ) internal view returns (uint256) {
    require(_sourceSpaceId > 0, 'Invalid space ID');
    address tokenAddress = spaceTokens[_sourceSpaceId];
    require(tokenAddress != address(0), 'Token not set for space');

    // Get the decayed balance
    return IDecayingSpaceToken(tokenAddress).balanceOf(_user);
  }

  /**
   * @dev Get total voting power from a specific space
   * @param _sourceSpaceId The space ID from which to derive total voting power
   * @return The total voting power (sum of decayed token balances held by space members)
   */
  function getTotalVotingPower(
    uint256 _sourceSpaceId
  ) external view override returns (uint256) {
    require(_sourceSpaceId > 0, 'Invalid space ID');
    address tokenAddress = spaceTokens[_sourceSpaceId];
    require(tokenAddress != address(0), 'Token not set for space');
    require(spaceFactory != address(0), 'Space factory not set');

    // Get all space members
    (, , , , address[] memory members, , , , , ) = IDAOSpaceFactory(
      spaceFactory
    ).getSpaceDetails(_sourceSpaceId);

    // Sum up decayed token balances of all members
    uint256 totalPower = 0;
    for (uint256 i = 0; i < members.length; i++) {
      totalPower += IDecayingSpaceToken(tokenAddress).balanceOf(members[i]);
    }

    return totalPower;
  }

  /**
   * @dev Apply decay to a user's balance and return the updated voting power (including delegated power)
   *      Protected against re-entrancy.
   * @param _user The address to apply decay and check voting power for
   * @param _sourceSpaceId The space ID from which to derive voting power
   * @return The updated voting power after applying decay (from space members only)
   */
  function applyDecayAndGetVotingPower(
    address _user,
    uint256 _sourceSpaceId
  ) external nonReentrant returns (uint256) {
    uint256 totalPower = 0;

    // Add user's own power if not delegated or no delegation contract set, applying decay
    if (
      address(delegationContract) == address(0) ||
      !delegationContract.hasDelegated(_user, _sourceSpaceId)
    ) {
      totalPower += _applyDecayAndGetOwnVotingPower(_user, _sourceSpaceId);
    }

    // Add delegated power if delegation contract is set, applying decay to each space member delegator
    if (address(delegationContract) != address(0)) {
      address[] memory delegators = delegationContract.getDelegators(
        _user,
        _sourceSpaceId
      );
      for (uint256 i = 0; i < delegators.length; i++) {
        // Only count delegated power from space members
        if (
          spaceFactory != address(0) &&
          IDAOSpaceFactory(spaceFactory).isMember(_sourceSpaceId, delegators[i])
        ) {
          totalPower += _applyDecayAndGetOwnVotingPower(
            delegators[i],
            _sourceSpaceId
          );
        }
      }
    }

    return totalPower;
  }

  /**
   * @dev Internal function to apply decay and get user's own voting power
   */
  function _applyDecayAndGetOwnVotingPower(
    address _user,
    uint256 _sourceSpaceId
  ) internal returns (uint256) {
    require(_sourceSpaceId > 0, 'Invalid space ID');
    address tokenAddress = spaceTokens[_sourceSpaceId];
    require(tokenAddress != address(0), 'Token not set for space');

    // Apply decay and get updated balance
    // This external call could potentially lead to re-entrancy if the token is malicious
    IDecayingSpaceToken(tokenAddress).applyDecay(_user);
    // State read after external call
    return IDecayingSpaceToken(tokenAddress).balanceOf(_user);
  }

  // New event for delegation contract
  event DelegationContractSet(address indexed delegationContract);
}
