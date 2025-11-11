import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

/**
 * Script to check implementation addresses of token contracts
 *
 * Usage:
 * 1. Edit the TOKEN_ADDRESSES array with the tokens you want to check
 * 2. Run: npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts
 *
 * Or pass addresses as command line arguments:
 * npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts 0x123... 0x456...
 *
 * Or load from a file:
 * npx ts-node scripts/base-mainnet-contracts-scripts/check-token-implementations.ts --file path/to/addresses.txt
 */

// ============== CONFIGURATION ==============

// Token addresses to check (edit this array or use command line args)
const TOKEN_ADDRESSES: string[] = [
  // Example addresses - replace with actual addresses or use command line args
  // '0x1234567890123456789012345678901234567890',
];

// Known implementation addresses for reference
const KNOWN_IMPLEMENTATIONS = {
  Regular: {
    old: '0xF47129F5ffA4D1CE40C4E9C4fc08Cb6d071d8Cd6',
    beforeTransferHelper: '0x8C105Debd4B222FFb2c438f7034158c6BA29aDB5',
    current: '0xeF88947ee8FC7Fb418d043ce65a67A4891B9FDF0',
  },
  Ownership: {
    old: '0xB06f27e16648F36C529839413f307a87b80d6ca1',
    current: '0xf9d5AdC2c7D305a5764AD6C6E0a99D3150b9cE39',
  },
  Decaying: {
    old: '0x5BE10FdAce191216236668d9cDb12772f73CB698',
    current: '0x4c69746B7907f76f6742e2e6e43c5f7Abd4A629B',
  },
};

// ============================================

interface TokenImplementationInfo {
  tokenAddress: string;
  implementationAddress: string | null;
  isUpgradable: boolean;
  matchesKnownImplementation: string | null;
  contractName: string | null;
  error: string | null;
}

async function getImplementationAddress(
  provider: ethers.JsonRpcProvider,
  tokenAddress: string,
): Promise<string | null> {
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
      return ethers.getAddress(implAddress);
    }

    return null;
  } catch (error) {
    console.error(
      `Error getting implementation address for ${tokenAddress}:`,
      error,
    );
    return null;
  }
}

function matchKnownImplementation(
  implementationAddress: string,
): string | null {
  const implLower = implementationAddress.toLowerCase();

  for (const [tokenType, implementations] of Object.entries(
    KNOWN_IMPLEMENTATIONS,
  )) {
    for (const [version, address] of Object.entries(implementations)) {
      if (address.toLowerCase() === implLower) {
        return `${tokenType} (${version})`;
      }
    }
  }

  return null;
}

async function checkTokenImplementation(
  provider: ethers.JsonRpcProvider,
  tokenAddress: string,
): Promise<TokenImplementationInfo> {
  const result: TokenImplementationInfo = {
    tokenAddress,
    implementationAddress: null,
    isUpgradable: false,
    matchesKnownImplementation: null,
    contractName: null,
    error: null,
  };

  try {
    // Validate address
    if (!ethers.isAddress(tokenAddress)) {
      result.error = 'Invalid address';
      return result;
    }

    // Get implementation address
    const implementationAddress = await getImplementationAddress(
      provider,
      tokenAddress,
    );

    if (!implementationAddress) {
      result.error = 'Not an upgradable proxy or no implementation found';
      return result;
    }

    result.implementationAddress = implementationAddress;
    result.isUpgradable = true;

    // Check if it matches a known implementation
    const match = matchKnownImplementation(implementationAddress);
    if (match) {
      result.matchesKnownImplementation = match;
    }

    // Try to get contract name (this is a simple check)
    // You could extend this to read the contract bytecode and compare
    const code = await provider.getCode(tokenAddress);
    if (code === '0x') {
      result.error = 'No contract code at address';
    }
  } catch (error: any) {
    result.error = error.message;
  }

  return result;
}

function loadAddressesFromFile(filePath: string): string[] {
  const absolutePath = path.resolve(filePath);
  console.log(`Loading addresses from: ${absolutePath}`);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const addresses = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.startsWith('0x'));

  console.log(`Loaded ${addresses.length} addresses from file`);
  return addresses;
}

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('TOKEN IMPLEMENTATION CHECKER');
  console.log('='.repeat(70));

  // Validate required environment variables
  if (!process.env.RPC_URL) {
    throw new Error('Missing required environment variable: RPC_URL');
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  console.log('\n✅ Connected to network');

  // Parse command line arguments
  const args = process.argv.slice(2);
  let addresses: string[] = [];

  if (args.length > 0 && args[0] === '--file') {
    // Load from file
    if (args.length < 2) {
      throw new Error('--file flag requires a file path');
    }
    addresses = loadAddressesFromFile(args[1]);
  } else if (args.length > 0) {
    // Use command line arguments
    addresses = args.filter((arg) => arg.startsWith('0x'));
    console.log(`\nUsing ${addresses.length} addresses from command line`);
  } else {
    // Use TOKEN_ADDRESSES array
    addresses = TOKEN_ADDRESSES;
    console.log(
      `\nUsing ${addresses.length} addresses from TOKEN_ADDRESSES array`,
    );
  }

  if (addresses.length === 0) {
    console.error(
      '\n❌ No token addresses provided! Please:',
      '\n  - Edit TOKEN_ADDRESSES array in the script',
      '\n  - Pass addresses as command line arguments',
      '\n  - Use --file path/to/addresses.txt',
    );
    process.exit(1);
  }

  console.log(`\nChecking ${addresses.length} token(s)...\n`);

  // Check each token
  const results: TokenImplementationInfo[] = [];
  for (let i = 0; i < addresses.length; i++) {
    const tokenAddress = addresses[i];
    console.log(`[${i + 1}/${addresses.length}] Checking: ${tokenAddress}`);

    const result = await checkTokenImplementation(provider, tokenAddress);
    results.push(result);

    if (result.error) {
      console.log(`  ❌ Error: ${result.error}`);
    } else {
      console.log(`  Implementation: ${result.implementationAddress}`);
      if (result.matchesKnownImplementation) {
        console.log(`  ✅ Matches: ${result.matchesKnownImplementation}`);
      } else {
        console.log(`  ⚠️  Unknown implementation (not in known list)`);
      }
    }
    console.log('');
  }

  // Print summary
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const upgradableTokens = results.filter((r) => r.isUpgradable);
  const nonUpgradableTokens = results.filter((r) => !r.isUpgradable);
  const errors = results.filter((r) => r.error !== null);

  console.log(`\nTotal tokens checked: ${results.length}`);
  console.log(`Upgradable tokens: ${upgradableTokens.length}`);
  console.log(`Non-upgradable/errors: ${nonUpgradableTokens.length}`);

  // Group by implementation
  if (upgradableTokens.length > 0) {
    console.log('\n📊 Tokens by implementation:');

    const byImplementation = new Map<string, string[]>();
    for (const result of upgradableTokens) {
      if (result.implementationAddress) {
        const key = result.implementationAddress;
        if (!byImplementation.has(key)) {
          byImplementation.set(key, []);
        }
        byImplementation.get(key)!.push(result.tokenAddress);
      }
    }

    for (const [implAddress, tokenAddresses] of byImplementation.entries()) {
      const match = matchKnownImplementation(implAddress);
      const label = match ? `${match}` : 'Unknown';
      console.log(
        `\n  ${implAddress} (${label}): ${tokenAddresses.length} token(s)`,
      );
      tokenAddresses.forEach((addr) => {
        console.log(`    - ${addr}`);
      });
    }
  }

  // Known implementations reference
  console.log('\n📚 Known implementation addresses:');
  console.log('\nRegular Tokens:');
  console.log(`  Old: ${KNOWN_IMPLEMENTATIONS.Regular.old}`);
  console.log(
    `  Before TransferHelper: ${KNOWN_IMPLEMENTATIONS.Regular.beforeTransferHelper}`,
  );
  console.log(`  Current: ${KNOWN_IMPLEMENTATIONS.Regular.current}`);
  console.log('\nOwnership Tokens:');
  console.log(`  Old: ${KNOWN_IMPLEMENTATIONS.Ownership.old}`);
  console.log(`  Current: ${KNOWN_IMPLEMENTATIONS.Ownership.current}`);
  console.log('\nDecaying Tokens:');
  console.log(`  Old: ${KNOWN_IMPLEMENTATIONS.Decaying.old}`);
  console.log(`  Current: ${KNOWN_IMPLEMENTATIONS.Decaying.current}`);

  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.join(__dirname, 'token-upgrade-data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const resultsFile = path.join(
    outputDir,
    `implementation-check-${timestamp}.json`,
  );
  fs.writeFileSync(
    resultsFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        results,
        summary: {
          total: results.length,
          upgradable: upgradableTokens.length,
          nonUpgradable: nonUpgradableTokens.length,
        },
      },
      null,
      2,
    ),
  );
  console.log(`\n📄 Results saved to: ${resultsFile}`);
}

main()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
