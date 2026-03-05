// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import './interfaces/IDAOSpaceFactory.sol';
import './interfaces/ITokenExtension.sol';

/**
 * @title SpaceToken
 * @dev Thin base token with extension hooks. Features (decay, mutual credit,
 *      etc.) live in separate extension contracts that the token calls during
 *      transfers and mints. Extensions have their own storage and can call back
 *      via extensionMint/extensionBurn.
 *
 *      Core: ERC20 + whitelists + pricing + archiving + naming + ownership
 *      Extensions: registered at init, called in transfer/mint pipeline
 */
contract SpaceToken is
  Initializable,
  ERC20Upgradeable,
  ERC20BurnableUpgradeable,
  OwnableUpgradeable,
  UUPSUpgradeable
{
  // =========================================================================
  // Structs
  // =========================================================================

  struct TokenConfig {
    string name;
    string symbol;
    address executor;
    uint256 spaceId;
    address spacesContract;
    uint256 maxSupply;
    bool transferable;
    bool fixedMaxSupply;
    bool autoMinting;
    uint256 tokenPrice;
    address priceCurrencyFeed;
    bool useTransferWhitelist;
    bool useReceiveWhitelist;
    address[] initialTransferWhitelist;
    address[] initialReceiveWhitelist;
    bool ownershipRestricted;
    address escrowContract;
  }

  // =========================================================================
  // Core storage
  // =========================================================================

  uint256 public spaceId;
  uint256 public maxSupply;
  bool public transferable;
  address public executor;
  address public transferHelper;

  bool public fixedMaxSupply;
  bool public autoMinting;
  uint256 public priceInUSD;

  mapping(address => bool) public canTransfer;
  mapping(address => bool) public canReceive;
  bool public useTransferWhitelist;
  bool public useReceiveWhitelist;

  bool public archived;

  address public spacesContract;
  uint256[] internal _transferWhitelistedSpaceIds;
  uint256[] internal _receiveWhitelistedSpaceIds;
  mapping(uint256 => bool) public isTransferWhitelistedSpace;
  mapping(uint256 => bool) public isReceiveWhitelistedSpace;

  address public priceCurrencyFeed;
  uint256 public tokenPrice;

  string private _customName;
  string private _customSymbol;

  // Ownership
  bool public ownershipRestricted;
  address public escrowContract;

  // =========================================================================
  // Extension registry
  // =========================================================================

  address[] public extensions;
  mapping(address => bool) public isExtension;
  address public balanceOfModifier;

  // =========================================================================
  // Events
  // =========================================================================

  event MaxSupplyUpdated(uint256 oldMaxSupply, uint256 newMaxSupply);
  event TransferableUpdated(bool transferable);
  event AutoMintingUpdated(bool autoMinting);
  event PriceInUSDUpdated(uint256 oldPrice, uint256 newPrice);
  event PriceCurrencyUpdated(uint256 price, address currencyFeed);
  event ArchivedStatusUpdated(bool archived);
  event TokenNameUpdated(string oldName, string newName);
  event TokenSymbolUpdated(string oldSymbol, string newSymbol);
  event TransferWhitelistUpdated(
    address indexed account,
    bool canTransfer
  );
  event ReceiveWhitelistUpdated(address indexed account, bool canReceive);
  event UseTransferWhitelistUpdated(bool enabled);
  event UseReceiveWhitelistUpdated(bool enabled);
  event TokensBurned(
    address indexed burner,
    address indexed from,
    uint256 amount
  );
  event TransferWhitelistSpaceAdded(uint256 indexed spaceId);
  event TransferWhitelistSpaceRemoved(uint256 indexed spaceId);
  event ReceiveWhitelistSpaceAdded(uint256 indexed spaceId);
  event ReceiveWhitelistSpaceRemoved(uint256 indexed spaceId);
  event ExtensionAdded(address indexed extension);
  event ExtensionRemoved(address indexed extension);

  // =========================================================================
  // Initialization
  // =========================================================================

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    TokenConfig memory base,
    address[] memory _extensions,
    address _balanceOfModifier
  ) public initializer {
    __ERC20_init(base.name, base.symbol);
    __ERC20Burnable_init();
    __Ownable_init(0x2687fe290b54d824c136Ceff2d5bD362Bc62019a);
    __UUPSUpgradeable_init();

    executor = base.executor;
    spaceId = base.spaceId;
    spacesContract = base.spacesContract;
    maxSupply = base.maxSupply;
    transferable = base.transferable;
    fixedMaxSupply = base.fixedMaxSupply;
    autoMinting = base.autoMinting;
    priceInUSD = base.tokenPrice;
    tokenPrice = base.tokenPrice;
    priceCurrencyFeed = base.priceCurrencyFeed;
    useTransferWhitelist = base.useTransferWhitelist;
    useReceiveWhitelist = base.useReceiveWhitelist;
    transferHelper = 0x479002F7602579203ffba3eE84ACC1BC5b0d6785;

    ownershipRestricted = base.ownershipRestricted;
    escrowContract = base.escrowContract;
    if (base.ownershipRestricted) {
      transferable = true;
    }

    canTransfer[base.executor] = true;
    canReceive[base.executor] = true;
    for (uint256 i = 0; i < base.initialTransferWhitelist.length; i++) {
      canTransfer[base.initialTransferWhitelist[i]] = true;
    }
    for (uint256 i = 0; i < base.initialReceiveWhitelist.length; i++) {
      canReceive[base.initialReceiveWhitelist[i]] = true;
    }

    // Register extensions and link them to this token
    for (uint256 i = 0; i < _extensions.length; i++) {
      extensions.push(_extensions[i]);
      isExtension[_extensions[i]] = true;
      ITokenExtension(_extensions[i]).setToken(address(this));
      emit ExtensionAdded(_extensions[i]);
    }
    balanceOfModifier = _balanceOfModifier;
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal override onlyOwner {}

  // =========================================================================
  // Extension callbacks — only registered extensions can call these
  // =========================================================================

  function extensionMint(address to, uint256 amount) external {
    require(isExtension[msg.sender], 'Not an extension');
    _mint(to, amount);
  }

  function extensionBurn(address from, uint256 amount) external {
    require(isExtension[msg.sender], 'Not an extension');
    _burn(from, amount);
  }

  /// @dev Raw ERC20 balance without extension adjustments (e.g., no decay).
  function rawBalanceOf(address account) public view returns (uint256) {
    return super.balanceOf(account);
  }

  // =========================================================================
  // Extension management (executor only)
  // =========================================================================

  function addExtension(address ext) external {
    require(msg.sender == executor, 'Only executor');
    require(!isExtension[ext], 'Already registered');
    extensions.push(ext);
    isExtension[ext] = true;
    emit ExtensionAdded(ext);
  }

  function removeExtension(address ext) external {
    require(msg.sender == executor, 'Only executor');
    require(isExtension[ext], 'Not registered');
    isExtension[ext] = false;
    for (uint256 i = 0; i < extensions.length; i++) {
      if (extensions[i] == ext) {
        extensions[i] = extensions[extensions.length - 1];
        extensions.pop();
        break;
      }
    }
    if (balanceOfModifier == ext) {
      balanceOfModifier = address(0);
    }
    emit ExtensionRemoved(ext);
  }

  function setBalanceOfModifier(address ext) external {
    require(msg.sender == executor, 'Only executor');
    balanceOfModifier = ext;
  }

  function getExtensions() external view returns (address[] memory) {
    return extensions;
  }

  // =========================================================================
  // ERC20 overrides
  // =========================================================================

  function name() public view virtual override returns (string memory) {
    if (bytes(_customName).length > 0) return _customName;
    return super.name();
  }

  function symbol() public view virtual override returns (string memory) {
    if (bytes(_customSymbol).length > 0) return _customSymbol;
    return super.symbol();
  }

  function balanceOf(
    address account
  ) public view virtual override returns (uint256) {
    uint256 raw = super.balanceOf(account);
    if (balanceOfModifier != address(0)) {
      return
        IBalanceOfModifier(balanceOfModifier).adjustedBalanceOf(
          account,
          raw
        );
    }
    return raw;
  }

  // =========================================================================
  // Transfer pipeline
  // =========================================================================

  function transfer(
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    address sender = _msgSender();
    _preTransferChecks(sender, to);

    if (sender == executor && autoMinting) {
      uint256 bal = super.balanceOf(sender);
      if (bal < amount) mint(sender, amount - bal);
    }

    _callBeforeTransfer(sender, to, amount);
    _transfer(sender, to, amount);
    _callAfterTransfer(sender, to, amount);

    return true;
  }

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    address spender = _msgSender();
    require(!archived, 'Token is archived');

    // Ownership: escrow can transfer to members without allowance
    if (
      ownershipRestricted &&
      spender == escrowContract &&
      _isOwnershipMember(to)
    ) {
      _callBeforeTransfer(from, to, amount);
      _transfer(from, to, amount);
      _callAfterTransfer(from, to, amount);
      return true;
    }

    _preTransferFromChecks(spender, from, to);

    if (from == executor && autoMinting) {
      uint256 bal = super.balanceOf(from);
      if (bal < amount) mint(from, amount - bal);
    }

    _callBeforeTransfer(from, to, amount);

    if (spender == transferHelper) {
      // TransferHelper skips allowance
    } else {
      _spendAllowance(from, spender, amount);
    }

    _transfer(from, to, amount);
    _callAfterTransfer(from, to, amount);

    return true;
  }

  function transferToEscrow(
    uint256 escrowId,
    uint256 amount
  ) external returns (bool) {
    require(ownershipRestricted, 'Ownership restrictions not enabled');
    require(!archived, 'Token is archived');
    require(
      _isOwnershipMember(msg.sender),
      'Only space members can transfer to escrow'
    );

    (bool existsOk, bytes memory existsData) = escrowContract.staticcall(
      abi.encodeWithSignature('escrowExists(uint256)', escrowId)
    );
    require(
      existsOk && abi.decode(existsData, (bool)),
      'Escrow does not exist'
    );

    (bool creatorOk, bytes memory creatorData) = escrowContract.staticcall(
      abi.encodeWithSignature('getEscrowCreator(uint256)', escrowId)
    );
    require(creatorOk, 'Failed to get escrow creator');
    require(
      abi.decode(creatorData, (address)) == executor,
      'Escrow must be created by space executor'
    );

    _transfer(msg.sender, escrowContract, amount);
    return true;
  }

  // =========================================================================
  // Extension hook dispatch
  // =========================================================================

  function _callBeforeTransfer(
    address from,
    address to,
    uint256 amount
  ) internal {
    for (uint256 i = 0; i < extensions.length; i++) {
      if (isExtension[extensions[i]]) {
        ITokenExtension(extensions[i]).beforeTransfer(from, to, amount);
      }
    }
  }

  function _callAfterTransfer(
    address from,
    address to,
    uint256 amount
  ) internal {
    for (uint256 i = 0; i < extensions.length; i++) {
      if (isExtension[extensions[i]]) {
        ITokenExtension(extensions[i]).afterTransfer(from, to, amount);
      }
    }
  }

  function _callBeforeMint(address to, uint256 amount) internal {
    for (uint256 i = 0; i < extensions.length; i++) {
      if (isExtension[extensions[i]]) {
        ITokenExtension(extensions[i]).beforeMint(to, amount);
      }
    }
  }

  // =========================================================================
  // Pre-transfer validation
  // =========================================================================

  function _preTransferChecks(address sender, address to) internal view {
    require(!archived, 'Token is archived');
    if (ownershipRestricted) {
      if (to == escrowContract && _isOwnershipMember(sender)) {
        revert('Use transferToEscrow function');
      }
      if (sender != executor) {
        revert('Only executor can transfer tokens');
      }
      require(
        _isOwnershipMember(to) || to == executor,
        'Can only transfer to space members'
      );
    } else {
      require(
        transferable || sender == executor,
        'Token transfers are disabled'
      );
    }

    if (sender != executor && useTransferWhitelist) {
      require(
        canTransfer[sender] || _isInTransferWhitelistedSpace(sender),
        'Sender not whitelisted to transfer'
      );
    }
    if (to != executor && useReceiveWhitelist) {
      require(
        canReceive[to] || _isInReceiveWhitelistedSpace(to),
        'Recipient not whitelisted to receive'
      );
    }
  }

  function _preTransferFromChecks(
    address spender,
    address from,
    address to
  ) internal view {
    if (ownershipRestricted) {
      if (spender == transferHelper && _isOwnershipMember(to)) {
        // allowed
      } else if (spender != executor) {
        revert('Only executor can transfer tokens');
      }
      if (to != executor) {
        require(
          _isOwnershipMember(to),
          'Can only transfer to space members'
        );
      }
    } else {
      require(
        transferable || spender == executor,
        'Token transfers are disabled'
      );
    }

    if (from != executor && useTransferWhitelist) {
      require(
        canTransfer[from] || _isInTransferWhitelistedSpace(from),
        'Sender not whitelisted to transfer'
      );
    }
    if (to != executor && useReceiveWhitelist) {
      require(
        canReceive[to] || _isInReceiveWhitelistedSpace(to),
        'Recipient not whitelisted to receive'
      );
    }
  }

  // =========================================================================
  // Mint
  // =========================================================================

  function mint(address to, uint256 amount) public virtual {
    require(msg.sender == executor, 'Only executor can mint');
    require(!archived, 'Token is archived');
    if (ownershipRestricted) {
      require(
        _isOwnershipMember(to) || to == executor,
        'Can only mint to space members or executor'
      );
    }
    require(
      maxSupply == 0 || totalSupply() + amount <= maxSupply,
      'Exceeds max supply'
    );
    _callBeforeMint(to, amount);
    _mint(to, amount);
  }

  // =========================================================================
  // BurnFrom
  // =========================================================================

  function burnFrom(address from, uint256 amount) public virtual override {
    if (msg.sender == executor) {
      _burn(from, amount);
      emit TokensBurned(msg.sender, from, amount);
    } else {
      super.burnFrom(from, amount);
      emit TokensBurned(msg.sender, from, amount);
    }
  }

  // =========================================================================
  // Ownership helper
  // =========================================================================

  function _isOwnershipMember(address account) internal view returns (bool) {
    return IDAOSpaceFactory(spacesContract).isMember(spaceId, account);
  }

  // =========================================================================
  // Whitelist helpers
  // =========================================================================

  function _isInTransferWhitelistedSpace(
    address account
  ) internal view returns (bool) {
    for (uint256 i = 0; i < _transferWhitelistedSpaceIds.length; i++) {
      uint256 sid = _transferWhitelistedSpaceIds[i];
      if (
        isTransferWhitelistedSpace[sid] &&
        IDAOSpaceFactory(spacesContract).isMember(sid, account)
      ) {
        return true;
      }
    }
    return false;
  }

  function _isInReceiveWhitelistedSpace(
    address account
  ) internal view returns (bool) {
    for (uint256 i = 0; i < _receiveWhitelistedSpaceIds.length; i++) {
      uint256 sid = _receiveWhitelistedSpaceIds[i];
      if (
        isReceiveWhitelistedSpace[sid] &&
        IDAOSpaceFactory(spacesContract).isMember(sid, account)
      ) {
        return true;
      }
    }
    return false;
  }

  function canAccountTransfer(address account) public view returns (bool) {
    if (account == executor) return true;
    if (!useTransferWhitelist) return true;
    if (canTransfer[account]) return true;
    return _isInTransferWhitelistedSpace(account);
  }

  function canAccountReceive(address account) public view returns (bool) {
    if (account == executor) return true;
    if (!useReceiveWhitelist) return true;
    if (canReceive[account]) return true;
    return _isInReceiveWhitelistedSpace(account);
  }

  // =========================================================================
  // Admin setters
  // =========================================================================

  function setMaxSupply(uint256 newMaxSupply) external virtual {
    require(msg.sender == executor, 'Only executor');
    require(!fixedMaxSupply, 'Max supply is fixed');
    require(
      newMaxSupply == 0 || newMaxSupply >= totalSupply(),
      'Below current supply'
    );
    uint256 old = maxSupply;
    maxSupply = newMaxSupply;
    emit MaxSupplyUpdated(old, newMaxSupply);
  }

  function setTransferable(bool _transferable) external virtual {
    require(msg.sender == executor, 'Only executor');
    transferable = _transferable;
    emit TransferableUpdated(_transferable);
  }

  function setArchived(bool _archived) external virtual {
    require(msg.sender == executor, 'Only executor');
    archived = _archived;
    emit ArchivedStatusUpdated(_archived);
  }

  function setTokenName(string memory newName) external virtual {
    require(msg.sender == executor, 'Only executor');
    require(bytes(newName).length > 0, 'Name cannot be empty');
    string memory oldName = name();
    _customName = newName;
    emit TokenNameUpdated(oldName, newName);
  }

  function setTokenSymbol(string memory newSymbol) external virtual {
    require(msg.sender == executor, 'Only executor');
    require(bytes(newSymbol).length > 0, 'Symbol cannot be empty');
    string memory oldSymbol = symbol();
    _customSymbol = newSymbol;
    emit TokenSymbolUpdated(oldSymbol, newSymbol);
  }

  function setAutoMinting(bool _autoMinting) external virtual {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner'
    );
    autoMinting = _autoMinting;
    emit AutoMintingUpdated(_autoMinting);
  }

  function setPriceInUSD(uint256 newPrice) external virtual {
    require(msg.sender == executor, 'Only executor');
    uint256 old = priceInUSD;
    priceInUSD = newPrice;
    tokenPrice = newPrice;
    emit PriceInUSDUpdated(old, newPrice);
  }

  function setPriceWithCurrency(
    uint256 newPrice,
    address currencyFeed
  ) external virtual {
    require(msg.sender == executor, 'Only executor');
    uint256 old = priceInUSD;
    priceInUSD = newPrice;
    tokenPrice = newPrice;
    priceCurrencyFeed = currencyFeed;
    emit PriceInUSDUpdated(old, newPrice);
    emit PriceCurrencyUpdated(newPrice, currencyFeed);
  }

  function setTransferHelper(address _transferHelper) external virtual {
    require(
      msg.sender == executor || msg.sender == owner(),
      'Only executor or owner'
    );
    transferHelper = _transferHelper;
  }

  // =========================================================================
  // Whitelist management
  // =========================================================================

  function batchSetTransferWhitelist(
    address[] calldata accounts,
    bool[] calldata allowed
  ) external virtual {
    require(msg.sender == executor, 'Only executor');
    require(accounts.length == allowed.length, 'Array lengths must match');
    for (uint256 i = 0; i < accounts.length; i++) {
      canTransfer[accounts[i]] = allowed[i];
      emit TransferWhitelistUpdated(accounts[i], allowed[i]);
    }
  }

  function batchSetReceiveWhitelist(
    address[] calldata accounts,
    bool[] calldata allowed
  ) external virtual {
    require(msg.sender == executor, 'Only executor');
    require(accounts.length == allowed.length, 'Array lengths must match');
    for (uint256 i = 0; i < accounts.length; i++) {
      canReceive[accounts[i]] = allowed[i];
      emit ReceiveWhitelistUpdated(accounts[i], allowed[i]);
    }
  }

  function setUseTransferWhitelist(bool enabled) external virtual {
    require(msg.sender == executor, 'Only executor');
    useTransferWhitelist = enabled;
    emit UseTransferWhitelistUpdated(enabled);
  }

  function setUseReceiveWhitelist(bool enabled) external virtual {
    require(msg.sender == executor, 'Only executor');
    useReceiveWhitelist = enabled;
    emit UseReceiveWhitelistUpdated(enabled);
  }

  function batchAddTransferWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external virtual {
    require(msg.sender == executor, 'Only executor');
    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (!isTransferWhitelistedSpace[spaceIds[i]]) {
        isTransferWhitelistedSpace[spaceIds[i]] = true;
        _transferWhitelistedSpaceIds.push(spaceIds[i]);
        emit TransferWhitelistSpaceAdded(spaceIds[i]);
      }
    }
  }

  function batchAddReceiveWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external virtual {
    require(msg.sender == executor, 'Only executor');
    for (uint256 i = 0; i < spaceIds.length; i++) {
      if (!isReceiveWhitelistedSpace[spaceIds[i]]) {
        isReceiveWhitelistedSpace[spaceIds[i]] = true;
        _receiveWhitelistedSpaceIds.push(spaceIds[i]);
        emit ReceiveWhitelistSpaceAdded(spaceIds[i]);
      }
    }
  }

  function batchRemoveTransferWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external virtual {
    require(msg.sender == executor, 'Only executor');
    for (uint256 j = 0; j < spaceIds.length; j++) {
      uint256 sid = spaceIds[j];
      if (isTransferWhitelistedSpace[sid]) {
        isTransferWhitelistedSpace[sid] = false;
        for (uint256 i = 0; i < _transferWhitelistedSpaceIds.length; i++) {
          if (_transferWhitelistedSpaceIds[i] == sid) {
            _transferWhitelistedSpaceIds[
              i
            ] = _transferWhitelistedSpaceIds[
              _transferWhitelistedSpaceIds.length - 1
            ];
            _transferWhitelistedSpaceIds.pop();
            break;
          }
        }
        emit TransferWhitelistSpaceRemoved(sid);
      }
    }
  }

  function batchRemoveReceiveWhitelistSpaces(
    uint256[] calldata spaceIds
  ) external virtual {
    require(msg.sender == executor, 'Only executor');
    for (uint256 j = 0; j < spaceIds.length; j++) {
      uint256 sid = spaceIds[j];
      if (isReceiveWhitelistedSpace[sid]) {
        isReceiveWhitelistedSpace[sid] = false;
        for (
          uint256 i = 0;
          i < _receiveWhitelistedSpaceIds.length;
          i++
        ) {
          if (_receiveWhitelistedSpaceIds[i] == sid) {
            _receiveWhitelistedSpaceIds[
              i
            ] = _receiveWhitelistedSpaceIds[
              _receiveWhitelistedSpaceIds.length - 1
            ];
            _receiveWhitelistedSpaceIds.pop();
            break;
          }
        }
        emit ReceiveWhitelistSpaceRemoved(sid);
      }
    }
  }

  function getTransferWhitelistedSpaces()
    external
    view
    returns (uint256[] memory)
  {
    return _transferWhitelistedSpaceIds;
  }

  function getReceiveWhitelistedSpaces()
    external
    view
    returns (uint256[] memory)
  {
    return _receiveWhitelistedSpaceIds;
  }
}
