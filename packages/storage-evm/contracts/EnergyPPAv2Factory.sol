// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol';
import './EnergyPPAv2.sol';
import './EnergyToken.sol';
import './RegularSpaceToken.sol';

/// @title  EnergyPPAv2Factory
/// @notice Deploys a fully configured EnergyPPAv2 community in a single
///         transaction: EnergyToken, RegularSpaceToken (UUPS proxy per source),
///         and the UUPS-proxied EnergyPPAv2 — all wired together.
///
///         Source ownership tokens use the same RegularSpaceToken implementation
///         as the rest of Hypha. The factory is set as `executor` on each token
///         so it can mint the initial distribution in this transaction.
contract EnergyPPAv2Factory is Ownable {

  struct SourceConfig {
    bytes32 sourceId;
    EnergyPPAv2.SourceType sourceType;
    string tokenName;
    string tokenSymbol;
    uint256 basePricePerKwh;
    address[] holders;       // receives tokens proportionally
    uint256[] holderAmounts; // token amounts per holder
  }

  struct MemberConfig {
    address memberAddress;
    uint256[] deviceIds;
    bytes32 metadataHash;
  }

  struct CommunityParams {
    address admin;
    address stablecoin;
    address communityAddress;
    address aggregatorAddress;
    uint16 communityFeeBps;
    uint16 aggregatorFeeBps;
    uint256 exportDeviceId;
    string energyTokenName;
    string energyTokenSymbol;
    SourceConfig[] sources;
    MemberConfig[] members;
  }

  /// @notice UUPS implementation for EnergyPPAv2 proxies.
  address public implementation;

  /// @notice UUPS implementation for RegularSpaceToken proxies (Hypha space token).
  address public regularSpaceTokenImplementation;

  struct CommunityRecord {
    address proxy;
    address energyToken;
    address admin;
    uint256 deployedAt;
  }

  CommunityRecord[] public communities;
  mapping(address => uint256[]) public adminCommunities;

  event CommunityDeployed(
    uint256 indexed communityId,
    address proxy,
    address energyToken,
    address admin,
    bytes32[] sourceIds,
    address[] sourceTokens
  );
  event ImplementationUpdated(address oldImpl, address newImpl);
  event RegularSpaceTokenImplementationUpdated(address oldImpl, address newImpl);

  constructor(
    address _energyPPAImplementation,
    address _regularSpaceTokenImplementation
  ) Ownable(msg.sender) {
    require(_energyPPAImplementation != address(0), 'Invalid PPA implementation');
    require(
      _regularSpaceTokenImplementation != address(0),
      'Invalid RegularSpaceToken implementation'
    );
    implementation = _energyPPAImplementation;
    regularSpaceTokenImplementation = _regularSpaceTokenImplementation;
  }

  function setImplementation(address newImpl) external onlyOwner {
    require(newImpl != address(0), 'Invalid implementation');
    address old = implementation;
    implementation = newImpl;
    emit ImplementationUpdated(old, newImpl);
  }

  function setRegularSpaceTokenImplementation(
    address newImpl
  ) external onlyOwner {
    require(newImpl != address(0), 'Invalid implementation');
    address old = regularSpaceTokenImplementation;
    regularSpaceTokenImplementation = newImpl;
    emit RegularSpaceTokenImplementationUpdated(old, newImpl);
  }

  /// @notice Deploy a complete community in one call.
  function deployCommunity(
    CommunityParams calldata p
  ) external returns (uint256 communityId, address proxy) {
    require(p.admin != address(0), 'Invalid admin');
    require(p.sources.length > 0, 'No sources');

    // 1. Deploy EnergyToken
    EnergyToken energyToken = new EnergyToken(
      p.energyTokenName,
      p.energyTokenSymbol,
      address(this)
    );

    // 2. Deploy UUPS proxy pointing at the shared EnergyPPAv2 implementation
    bytes memory initData = abi.encodeCall(
      EnergyPPAv2.initialize,
      (address(this), address(energyToken), p.stablecoin, address(0))
    );
    ERC1967Proxy proxyContract = new ERC1967Proxy(implementation, initData);
    proxy = address(proxyContract);
    EnergyPPAv2 ppa = EnergyPPAv2(proxy);

    // 3. Authorize the PPA proxy on the EnergyToken, then transfer ownership to admin
    energyToken.setAuthorized(proxy, true);
    energyToken.transferOwnership(p.admin);

    // 4. Whitelist factory temporarily so we can configure
    ppa.updateWhitelist(address(this), true);

    // 5. Register sources & deploy RegularSpaceToken proxies
    bytes32[] memory sourceIds = new bytes32[](p.sources.length);
    address[] memory sourceTokens = new address[](p.sources.length);

    for (uint256 i = 0; i < p.sources.length; i++) {
      SourceConfig calldata s = p.sources[i];
      require(s.holders.length == s.holderAmounts.length, 'Holder mismatch');

      uint256 totalSupply = 0;
      for (uint256 j = 0; j < s.holderAmounts.length; j++) {
        totalSupply += s.holderAmounts[j];
      }

      uint256 spaceId = uint256(
        keccak256(abi.encodePacked(block.chainid, address(this), s.sourceId, i))
      );

      bytes memory tokenInit = abi.encodeCall(
        RegularSpaceToken.initialize,
        (
          s.tokenName,
          s.tokenSymbol,
          address(this),
          spaceId,
          totalSupply,
          true,
          true,
          false,
          0,
          address(0),
          false,
          false,
          new address[](0),
          new address[](0),
          new uint256[](0),
          new uint256[](0),
          0,
          new uint256[](0),
          address(0),
          0,
          0,
          uint8(0),
          new uint256[](0)
        )
      );

      address tokenProxy = address(
        new ERC1967Proxy(regularSpaceTokenImplementation, tokenInit)
      );
      RegularSpaceToken srcToken = RegularSpaceToken(tokenProxy);

      for (uint256 j = 0; j < s.holders.length; j++) {
        if (s.holderAmounts[j] > 0) {
          srcToken.mint(s.holders[j], s.holderAmounts[j]);
        }
      }

      ppa.registerSource(s.sourceId, s.sourceType, tokenProxy, s.basePricePerKwh);
      sourceIds[i] = s.sourceId;
      sourceTokens[i] = tokenProxy;
    }

    // 6. Add members
    for (uint256 i = 0; i < p.members.length; i++) {
      MemberConfig calldata m = p.members[i];
      ppa.addMember(m.memberAddress, m.deviceIds, m.metadataHash);
    }

    // 7. Configure fees & addresses
    if (p.communityAddress != address(0)) {
      ppa.setCommunityAddress(p.communityAddress);
    }
    if (p.aggregatorAddress != address(0)) {
      ppa.setAggregatorAddress(p.aggregatorAddress);
    }
    if (p.communityFeeBps > 0) {
      ppa.setCommunityFeeBps(p.communityFeeBps);
    }
    if (p.aggregatorFeeBps > 0) {
      ppa.setAggregatorFeeBps(p.aggregatorFeeBps);
    }
    if (p.exportDeviceId > 0) {
      ppa.setExportDeviceId(p.exportDeviceId);
    }

    // 8. Whitelist the admin, remove factory from whitelist, transfer ownership
    ppa.updateWhitelist(p.admin, true);
    ppa.updateWhitelist(address(this), false);
    ppa.transferOwnership(p.admin);

    // 9. Record
    communityId = communities.length;
    communities.push(CommunityRecord({
      proxy: proxy,
      energyToken: address(energyToken),
      admin: p.admin,
      deployedAt: block.timestamp
    }));
    adminCommunities[p.admin].push(communityId);

    emit CommunityDeployed(communityId, proxy, address(energyToken), p.admin, sourceIds, sourceTokens);
  }

  function getCommunityCount() external view returns (uint256) {
    return communities.length;
  }

  function getAdminCommunities(
    address admin
  ) external view returns (uint256[] memory) {
    return adminCommunities[admin];
  }
}
