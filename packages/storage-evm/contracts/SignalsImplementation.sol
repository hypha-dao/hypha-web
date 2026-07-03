// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './storage/SignalsStorage.sol';

/**
 * @title Signals
 * @dev On-chain event log for signal (coherence) upvotes.
 *
 * Signals themselves live off-chain; this contract only mirrors upvote
 * activity as events so it is publicly auditable. Platform relayers call
 * `recordUpvote` / `recordUpvoteRemoval` in the background after the
 * off-chain vote is stored.
 */
contract SignalsImplementation is
  Initializable,
  OwnableUpgradeable,
  UUPSUpgradeable,
  SignalsStorage
{
  /**
   * @dev Emitted when a member upvotes a signal.
   * @param spaceId The on-chain space id the signal belongs to.
   * @param signalId The off-chain signal id.
   * @param voter The member's wallet address.
   * @param amount The voting power committed to the upvote.
   */
  event SignalUpvoted(
    uint256 indexed spaceId,
    uint256 indexed signalId,
    address indexed voter,
    uint256 amount
  );

  /**
   * @dev Emitted when a member removes their upvote from a signal.
   */
  event SignalUpvoteRemoved(
    uint256 indexed spaceId,
    uint256 indexed signalId,
    address indexed voter
  );

  event RelayerSet(address indexed relayer, bool authorized);

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

  modifier onlyRelayerOrOwner() {
    require(
      relayers[msg.sender] || msg.sender == owner(),
      'Not an authorized relayer'
    );
    _;
  }

  /**
   * @dev Authorize or revoke a relayer address.
   */
  function setRelayer(address _relayer, bool _authorized) external onlyOwner {
    require(_relayer != address(0), 'Relayer cannot be zero address');
    relayers[_relayer] = _authorized;
    emit RelayerSet(_relayer, _authorized);
  }

  /**
   * @dev Record an upvote (or an updated upvote amount) for a signal.
   */
  function recordUpvote(
    uint256 _spaceId,
    uint256 _signalId,
    address _voter,
    uint256 _amount
  ) external onlyRelayerOrOwner {
    require(_spaceId > 0, 'Invalid space ID');
    require(_voter != address(0), 'Voter cannot be zero address');
    require(_amount > 0, 'Amount must be greater than zero');
    emit SignalUpvoted(_spaceId, _signalId, _voter, _amount);
  }

  /**
   * @dev Record the removal of a voter's upvote from a signal.
   */
  function recordUpvoteRemoval(
    uint256 _spaceId,
    uint256 _signalId,
    address _voter
  ) external onlyRelayerOrOwner {
    require(_spaceId > 0, 'Invalid space ID');
    require(_voter != address(0), 'Voter cannot be zero address');
    emit SignalUpvoteRemoved(_spaceId, _signalId, _voter);
  }
}
