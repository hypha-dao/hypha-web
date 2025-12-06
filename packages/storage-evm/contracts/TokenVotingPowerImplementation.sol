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
 * @dev Manages voting power calculations based on ERC20 token holdings with delegation support
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
   * @dev Link a space with its voting token - can be set by the space's executor or contract owner
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

    // Check that the caller is either the contract owner or the space's executor
    bool isOwner = msg.sender == owner();
    bool isSpaceExecutor = false;

    if (!isOwner) {
      address spaceExecutor = IDAOSpaceFactory(spaceFactory).getSpaceExecutor(
        _spaceId
      );
      isSpaceExecutor = msg.sender == spaceExecutor;
    }

    require(
      isOwner || isSpaceExecutor,
      'Only contract owner or space executor can set space token'
    );

    spaceTokens[_spaceId] = _tokenAddress;
    emit SpaceTokenSet(_spaceId, _tokenAddress);
  }

  /**
   * @dev Get voting power for a user from a specific space based on token holdings (including delegated power)
   * @param _user The address to check voting power for
   * @param _sourceSpaceId The space ID from which to derive voting power
   * @return The voting power (token balance of the user + delegated balances from space members only)
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

    return IERC20(tokenAddress).balanceOf(_user);
  }

  /**
   * @dev Get total voting power from a specific space
   * @param _sourceSpaceId The space ID from which to derive total voting power
   * @return The total voting power (sum of token balances held by space members)
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

    // Sum up token balances of all members
    uint256 totalPower = 0;
    for (uint256 i = 0; i < members.length; i++) {
      totalPower += IERC20(tokenAddress).balanceOf(members[i]);
    }

    return totalPower;
  }

  // New event for delegation contract
  event DelegationContractSet(address indexed delegationContract);
}
