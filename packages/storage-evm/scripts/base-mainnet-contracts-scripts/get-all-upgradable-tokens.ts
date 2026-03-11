import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Base Mainnet contract addresses
const CONTRACTS = {
  REGULAR_TOKEN_FACTORY: '0x95A33EC94de2189893884DaD63eAa19f7390144a',
  OWNERSHIP_TOKEN_FACTORY: '0xA1eDf096B72226ae2f7BDEb12E9c9C82152BccB6',
  DECAYING_TOKEN_FACTORY: '0x299f4D2327933c1f363301dbd2a28379ccD5539b',
  DAO_SPACE_FACTORY: '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9',
};

interface TokenFactoryInterface {
  getSpaceToken: (spaceId: number) => Promise<string[]>;
  isTokenDeployedByFactory: (tokenAddress: string) => Promise<boolean>;
}

interface DAOSpaceFactoryInterface {
  spaceCounter: () => Promise<bigint>;
}

const tokenFactoryAbi = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'spaceId',
        type: 'uint256',
      },
    ],
    name: 'getSpaceToken',
    outputs: [
      {
        internalType: 'address[]',
        name: '',
        type: 'address[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'tokenAddress',
        type: 'address',
      },
    ],
    name: 'isTokenDeployedByFactory',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

const daoSpaceFactoryAbi = [
  {
    inputs: [],
    name: 'spaceCounter',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

// ABI to check if a contract is upgradable (has implementation slot)
const proxyAbi = [
  {
    inputs: [],
    name: 'implementation',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

interface TokenInfo {
  address: string;
  spaceId: number;
  implementationAddress: string | null;
  isUpgradable: boolean;
}

interface FactoryTokens {
  factoryType: string;
  factoryAddress: string;
  tokens: TokenInfo[];
}

async function isTokenUpgradable(
  provider: ethers.JsonRpcProvider,
  tokenAddress: string,
): Promise<{ isUpgradable: boolean; implementationAddress: string | null }> {
  try {
    // ERC1967 implementation slot: keccak256("eip1967.proxy.implementation") - 1
    const implementationSlot =
      '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
    const implementationAddress = await provider.getStorage(
      tokenAddress,
      implementationSlot,
    );

    // If the slot is not empty (not all zeros), it's an upgradable proxy
    if (
      implementationAddress !==
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      // Convert the storage value to an address (take last 40 hex chars after 0x)
      const implAddress =
        '0x' + implementationAddress.slice(-40).padStart(40, '0');
      return {
        isUpgradable: true,
        implementationAddress: ethers.getAddress(implAddress),
      };
    }

    return { isUpgradable: false, implementationAddress: null };
  } catch (error) {
    console.error(
      `Error checking if token ${tokenAddress} is upgradable:`,
      error,
    );
    return { isUpgradable: false, implementationAddress: null };
  }
}

async function getTokensFromFactory(
  provider: ethers.JsonRpcProvider,
  factoryAddress: string,
  factoryType: string,
  totalSpaces: bigint,
): Promise<FactoryTokens> {
  console.log(`\n=== Fetching tokens from ${factoryType} Factory ===`);
  console.log(`Factory address: ${factoryAddress}`);

  const factory = new ethers.Contract(
    factoryAddress,
    tokenFactoryAbi,
    provider,
  ) as ethers.Contract & TokenFactoryInterface;

  const tokens: TokenInfo[] = [];
  let tokenCount = 0;
  let upgradableCount = 0;

  // Iterate through all spaces
  for (let spaceId = 1; spaceId <= Number(totalSpaces); spaceId++) {
    try {
      const tokenAddresses = await factory.getSpaceToken(spaceId);

      for (const tokenAddress of tokenAddresses) {
        tokenCount++;

        // Check if token is deployed by this factory
        const isFromFactory = await factory.isTokenDeployedByFactory(
          tokenAddress,
        );

        if (!isFromFactory) {
          console.log(
            `⚠️  Token ${tokenAddress} in space ${spaceId} not deployed by factory, skipping`,
          );
          continue;
        }

        // Check if token is upgradable
        const { isUpgradable, implementationAddress } = await isTokenUpgradable(
          provider,
          tokenAddress,
        );

        if (isUpgradable) {
          upgradableCount++;
          tokens.push({
            address: tokenAddress,
            spaceId,
            implementationAddress,
            isUpgradable: true,
          });
          console.log(
            `✅ Space ${spaceId}: Upgradable token found at ${tokenAddress}`,
          );
        } else {
          console.log(
            `⚠️  Space ${spaceId}: Non-upgradable token at ${tokenAddress}`,
          );
        }
      }
    } catch (error: any) {
      // Space might not exist or have no tokens, skip silently
      if (!error.message.includes('call revert exception')) {
        console.error(`Error fetching tokens for space ${spaceId}:`, error);
      }
    }
  }

  console.log(`\n${factoryType} Factory Summary:`);
  console.log(`  Total tokens found: ${tokenCount}`);
  console.log(`  Upgradable tokens: ${upgradableCount}`);
  console.log(`  Non-upgradable tokens: ${tokenCount - upgradableCount}`);

  return {
    factoryType,
    factoryAddress,
    tokens,
  };
}

async function saveTokensToFile(
  allFactoryTokens: FactoryTokens[],
): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.join(__dirname, 'token-upgrade-data');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save comprehensive JSON file
  const jsonFile = path.join(outputDir, `upgradable-tokens-${timestamp}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(allFactoryTokens, null, 2));
  console.log(`\n✅ Saved comprehensive data to: ${jsonFile}`);

  // Save individual CSV files for each factory
  for (const factoryData of allFactoryTokens) {
    if (factoryData.tokens.length > 0) {
      const csvFile = path.join(
        outputDir,
        `${factoryData.factoryType.toLowerCase()}-tokens-${timestamp}.csv`,
      );
      const csvContent = [
        'Token Address,Space ID,Implementation Address',
        ...factoryData.tokens.map(
          (token) =>
            `${token.address},${token.spaceId},${token.implementationAddress}`,
        ),
      ].join('\n');
      fs.writeFileSync(csvFile, csvContent);
      console.log(
        `✅ Saved ${factoryData.factoryType} tokens CSV to: ${csvFile}`,
      );
    }
  }

  // Save a simple address list for each factory (for easy copy-paste into upgrade scripts)
  for (const factoryData of allFactoryTokens) {
    if (factoryData.tokens.length > 0) {
      const addressListFile = path.join(
        outputDir,
        `${factoryData.factoryType.toLowerCase()}-addresses-${timestamp}.txt`,
      );
      const addressList = factoryData.tokens
        .map((token) => token.address)
        .join('\n');
      fs.writeFileSync(addressListFile, addressList);
      console.log(
        `✅ Saved ${factoryData.factoryType} address list to: ${addressListFile}`,
      );
    }
  }
}

async function main(): Promise<void> {
  // Validate required environment variables
  if (!process.env.RPC_URL) {
    throw new Error('Missing required environment variable: RPC_URL');
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  console.log('Connected to network');

  // Get the DAOSpaceFactory contract to get total space count
  const daoSpaceFactory = new ethers.Contract(
    CONTRACTS.DAO_SPACE_FACTORY,
    daoSpaceFactoryAbi,
    provider,
  ) as ethers.Contract & DAOSpaceFactoryInterface;

  const totalSpaces = await daoSpaceFactory.spaceCounter();
  console.log(`Total number of spaces: ${totalSpaces}`);

  const allFactoryTokens: FactoryTokens[] = [];

  // Fetch tokens from Regular Token Factory
  const regularTokens = await getTokensFromFactory(
    provider,
    CONTRACTS.REGULAR_TOKEN_FACTORY,
    'Regular',
    totalSpaces,
  );
  allFactoryTokens.push(regularTokens);

  // Fetch tokens from Ownership Token Factory
  const ownershipTokens = await getTokensFromFactory(
    provider,
    CONTRACTS.OWNERSHIP_TOKEN_FACTORY,
    'Ownership',
    totalSpaces,
  );
  allFactoryTokens.push(ownershipTokens);

  // Fetch tokens from Decaying Token Factory
  const decayingTokens = await getTokensFromFactory(
    provider,
    CONTRACTS.DECAYING_TOKEN_FACTORY,
    'Decaying',
    totalSpaces,
  );
  allFactoryTokens.push(decayingTokens);

  // Print summary
  console.log('\n\n=== OVERALL SUMMARY ===');
  for (const factoryData of allFactoryTokens) {
    console.log(
      `${factoryData.factoryType} Factory: ${factoryData.tokens.length} upgradable tokens`,
    );
  }

  const totalUpgradableTokens = allFactoryTokens.reduce(
    (sum, factory) => sum + factory.tokens.length,
    0,
  );
  console.log(
    `\nTotal upgradable tokens across all factories: ${totalUpgradableTokens}`,
  );

  // Save to files
  await saveTokensToFile(allFactoryTokens);

  console.log(
    '\n✅ All done! Check the token-upgrade-data directory for output files.',
  );
}

main()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
