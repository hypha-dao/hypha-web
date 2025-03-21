//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// DAOSpaceFactoryImplementation
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * [__View Contract on Base Basescan__](https://basescan.org/address/0xff6006c67803a380Db25230F1aEc605790C405a1)
 */
export const daoSpaceFactoryImplementationAbi = [
  { type: 'constructor', inputs: [], stateMutability: 'nonpayable' },
  {
    type: 'error',
    inputs: [{ name: 'target', internalType: 'address', type: 'address' }],
    name: 'AddressEmptyCode',
  },
  {
    type: 'error',
    inputs: [
      { name: 'implementation', internalType: 'address', type: 'address' },
    ],
    name: 'ERC1967InvalidImplementation',
  },
  { type: 'error', inputs: [], name: 'ERC1967NonPayable' },
  { type: 'error', inputs: [], name: 'FailedCall' },
  { type: 'error', inputs: [], name: 'InvalidInitialization' },
  { type: 'error', inputs: [], name: 'NotInitializing' },
  {
    type: 'error',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'OwnableInvalidOwner',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'OwnableUnauthorizedAccount',
  },
  { type: 'error', inputs: [], name: 'UUPSUnauthorizedCallContext' },
  {
    type: 'error',
    inputs: [{ name: 'slot', internalType: 'bytes32', type: 'bytes32' }],
    name: 'UUPSUnsupportedProxiableUUID',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newAddress',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'DirectoryContractUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newAddress',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'ExitMethodDirectoryContractUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'version',
        internalType: 'uint64',
        type: 'uint64',
        indexed: false,
      },
    ],
    name: 'Initialized',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newAddress',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'JoinMethodDirectoryContractUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'spaceId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'member',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'MemberJoined',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'spaceId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      {
        name: 'member',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'MemberRemoved',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newAddress',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'ProposalManagerUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'spaceId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      { name: 'name', internalType: 'string', type: 'string', indexed: false },
      {
        name: 'description',
        internalType: 'string',
        type: 'string',
        indexed: false,
      },
      {
        name: 'imageUrl',
        internalType: 'string',
        type: 'string',
        indexed: false,
      },
      {
        name: 'unity',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'quorum',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'votingPowerSource',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'exitMethod',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'joinMethod',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'creator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'executor',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'SpaceCreated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newAddress',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'TokenFactoryContractUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'implementation',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'Upgraded',
  },
  {
    type: 'function',
    inputs: [],
    name: 'UPGRADE_INTERFACE_VERSION',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: '_spaceId', internalType: 'uint256', type: 'uint256' },
      { name: '_tokenAddress', internalType: 'address', type: 'address' },
    ],
    name: 'addTokenToSpace',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'params',
        internalType: 'struct IDAOSpaceFactory.SpaceCreationParams',
        type: 'tuple',
        components: [
          { name: 'name', internalType: 'string', type: 'string' },
          { name: 'description', internalType: 'string', type: 'string' },
          { name: 'imageUrl', internalType: 'string', type: 'string' },
          { name: 'unity', internalType: 'uint256', type: 'uint256' },
          { name: 'quorum', internalType: 'uint256', type: 'uint256' },
          {
            name: 'votingPowerSource',
            internalType: 'uint256',
            type: 'uint256',
          },
          { name: 'exitMethod', internalType: 'uint256', type: 'uint256' },
          { name: 'joinMethod', internalType: 'uint256', type: 'uint256' },
          { name: 'createToken', internalType: 'bool', type: 'bool' },
          { name: 'tokenName', internalType: 'string', type: 'string' },
          { name: 'tokenSymbol', internalType: 'string', type: 'string' },
        ],
      },
    ],
    name: 'createSpace',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'directoryContract',
    outputs: [
      { name: '', internalType: 'contract IDirectory', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'executorToSpaceId',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'exitMethodDirectoryAddress',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '_spaceId', internalType: 'uint256', type: 'uint256' }],
    name: 'getSpaceDetails',
    outputs: [
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'unity', internalType: 'uint256', type: 'uint256' },
      { name: 'quorum', internalType: 'uint256', type: 'uint256' },
      { name: 'votingPowerSource', internalType: 'uint256', type: 'uint256' },
      { name: 'tokenAddresses', internalType: 'address[]', type: 'address[]' },
      { name: 'members', internalType: 'address[]', type: 'address[]' },
      { name: 'exitMethod', internalType: 'uint256', type: 'uint256' },
      { name: 'joinMethod', internalType: 'uint256', type: 'uint256' },
      { name: 'createdAt', internalType: 'uint256', type: 'uint256' },
      { name: 'creator', internalType: 'address', type: 'address' },
      { name: 'executor', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '_spaceId', internalType: 'uint256', type: 'uint256' }],
    name: 'getSpaceExecutor',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: '_spaceAddress', internalType: 'address', type: 'address' },
    ],
    name: 'getSpaceId',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '_spaceId', internalType: 'uint256', type: 'uint256' }],
    name: 'getSpaceMemberAddresses',
    outputs: [{ name: '', internalType: 'address[]', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '_spaceId', internalType: 'uint256', type: 'uint256' }],
    name: 'getSpaceMembers',
    outputs: [{ name: '', internalType: 'address[]', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: '_spaceId', internalType: 'uint256', type: 'uint256' },
      { name: '_tokenAddress', internalType: 'address', type: 'address' },
    ],
    name: 'hasToken',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'initialOwner', internalType: 'address', type: 'address' },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '_spaceId', internalType: 'uint256', type: 'uint256' },
      { name: '_userAddress', internalType: 'address', type: 'address' },
    ],
    name: 'isMember',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: '_spaceId', internalType: 'uint256', type: 'uint256' },
      { name: '_userAddress', internalType: 'address', type: 'address' },
    ],
    name: 'isSpaceCreator',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: '_spaceId', internalType: 'uint256', type: 'uint256' },
      { name: '_member', internalType: 'address', type: 'address' },
    ],
    name: 'isSpaceMember',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'joinMethodDirectoryAddress',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '_spaceId', internalType: 'uint256', type: 'uint256' }],
    name: 'joinSpace',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'proposalManagerAddress',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'proxiableUUID',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: '_spaceId', internalType: 'uint256', type: 'uint256' },
      { name: '_memberToRemove', internalType: 'address', type: 'address' },
    ],
    name: 'removeMember',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: '_tokenFactoryAddress',
        internalType: 'address',
        type: 'address',
      },
      {
        name: '_joinMethodDirectoryAddress',
        internalType: 'address',
        type: 'address',
      },
      {
        name: '_exitMethodDirectoryAddress',
        internalType: 'address',
        type: 'address',
      },
      {
        name: '_proposalManagerAddress',
        internalType: 'address',
        type: 'address',
      },
    ],
    name: 'setContracts',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'spaceCounter',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'spaces',
    outputs: [
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'description', internalType: 'string', type: 'string' },
      { name: 'imageUrl', internalType: 'string', type: 'string' },
      { name: 'unity', internalType: 'uint256', type: 'uint256' },
      { name: 'quorum', internalType: 'uint256', type: 'uint256' },
      { name: 'votingPowerSource', internalType: 'uint256', type: 'uint256' },
      { name: 'exitMethod', internalType: 'uint256', type: 'uint256' },
      { name: 'joinMethod', internalType: 'uint256', type: 'uint256' },
      { name: 'createdAt', internalType: 'uint256', type: 'uint256' },
      { name: 'creator', internalType: 'address', type: 'address' },
      { name: 'executor', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'tokenFactoryAddress',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newImplementation', internalType: 'address', type: 'address' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'upgradeToAndCall',
    outputs: [],
    stateMutability: 'payable',
  },
] as const

/**
 * [__View Contract on Base Basescan__](https://basescan.org/address/0xff6006c67803a380Db25230F1aEc605790C405a1)
 */
export const daoSpaceFactoryImplementationAddress = {
  8453: '0xff6006c67803a380Db25230F1aEc605790C405a1',
} as const

/**
 * [__View Contract on Base Basescan__](https://basescan.org/address/0xff6006c67803a380Db25230F1aEc605790C405a1)
 */
export const daoSpaceFactoryImplementationConfig = {
  address: daoSpaceFactoryImplementationAddress,
  abi: daoSpaceFactoryImplementationAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SpaceFactoryV1
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const spaceFactoryV1Abi = [
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'pure',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SpaceFactoryV2
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const spaceFactoryV2Abi = [
  {
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '_name', internalType: 'string', type: 'string' }],
    name: 'setName',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'version',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'pure',
  },
] as const
