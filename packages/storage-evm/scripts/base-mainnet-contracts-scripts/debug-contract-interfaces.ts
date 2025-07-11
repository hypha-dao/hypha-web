import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Different ABIs to test
const spaceTokensAbi = [
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'spaceTokens',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const generalContractAbi = [
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Check if it's a proxy
  {
    inputs: [],
    name: 'implementation',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Check for space factory in SpaceVotingPower
  {
    inputs: [],
    name: 'spaceFactory',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function debugContract(
  contractName: string,
  contractAddress: string,
  wallet: ethers.Wallet,
): Promise<void> {
  console.log(`\n🔍 Debugging ${contractName} (${contractAddress})`);

  try {
    // First check if the contract exists
    const code = await wallet.provider.getCode(contractAddress);
    if (code === '0x') {
      console.log('❌ No contract deployed at this address');
      return;
    }
    console.log('✅ Contract exists (has bytecode)');

    // Test basic contract calls
    const generalContract = new ethers.Contract(
      contractAddress,
      generalContractAbi,
      wallet,
    );

    // Try to call owner()
    try {
      const owner = await generalContract.owner();
      console.log(`✅ owner(): ${owner}`);
    } catch (error) {
      console.log('❌ owner() call failed:', (error as Error).message);
    }

    // Try to call implementation() if it's a proxy
    try {
      const impl = await generalContract.implementation();
      console.log(`✅ implementation(): ${impl}`);
    } catch (error) {
      console.log(
        '❌ implementation() call failed (not a proxy or different proxy type)',
      );
    }

    // Try to call spaceFactory() for SpaceVotingPower
    if (contractName === 'SpaceVotingPower') {
      try {
        const spaceFactory = await generalContract.spaceFactory();
        console.log(`✅ spaceFactory(): ${spaceFactory}`);
      } catch (error) {
        console.log('❌ spaceFactory() call failed:', (error as Error).message);
      }
    }

    // Now test the spaceTokens call
    const spaceTokensContract = new ethers.Contract(
      contractAddress,
      spaceTokensAbi,
      wallet,
    );

    try {
      const tokenAddress = await spaceTokensContract.spaceTokens(1);
      console.log(`✅ spaceTokens(1): ${tokenAddress}`);
    } catch (error) {
      console.log('❌ spaceTokens(1) call failed:', (error as Error).message);

      // Check if it's a function signature issue
      if (
        (error as Error).message.includes(
          'function selector was not recognized',
        )
      ) {
        console.log('🔍 This contract does not have a spaceTokens function');
      }
    }

    // Try a few more space IDs if the first one worked
    if (contractName === 'OwnershipTokenVotingPower') {
      console.log('🔍 Testing multiple space IDs...');
      for (const spaceId of [144, 1, 2, 10]) {
        try {
          const tokenAddress = await spaceTokensContract.spaceTokens(spaceId);
          console.log(`✅ spaceTokens(${spaceId}): ${tokenAddress}`);
        } catch (error) {
          console.log(
            `❌ spaceTokens(${spaceId}) failed: ${(
              error as Error
            ).message.substring(0, 100)}...`,
          );
        }
      }
    }
  } catch (error) {
    console.log('❌ General error:', (error as Error).message);
  }
}

async function main(): Promise<void> {
  // Connect to network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  console.log(
    `Connected to network: ${await provider.getNetwork().then((n) => n.name)}`,
  );

  // Initialize wallet
  let wallet;
  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey) {
      const cleanPrivateKey = privateKey.startsWith('0x')
        ? privateKey.slice(2)
        : privateKey;
      wallet = new ethers.Wallet(cleanPrivateKey, provider);
    } else {
      wallet = ethers.Wallet.createRandom().connect(provider);
    }
  } catch (error) {
    console.error('Error setting up wallet:', error);
    return;
  }

  console.log(`Using wallet address: ${wallet.address}`);

  // Test the contracts that are failing
  const contractsToTest = [
    {
      name: 'TokenVotingPower',
      address: '0x3214DE1Eb858799Db626Bd9699e78c2E6E33D2BE',
    },
    {
      name: 'SpaceVotingPower',
      address: '0x87537f0B5B8f34D689d484E743e83F82636E14a7',
    },
    {
      name: 'VoteDecayTokenVotingPower',
      address: '0x6dB5E05B21c68550B63a7404a3B68F81c159DAee',
    },
    {
      name: 'OwnershipTokenVotingPower',
      address: '0x255c7b5DaC3696199fEF7A8CC6Cc87190bc36eFd',
    },
  ];

  for (const contract of contractsToTest) {
    await debugContract(contract.name, contract.address, wallet);
  }

  console.log('\n' + '='.repeat(60));
  console.log('DIAGNOSIS SUMMARY:');
  console.log('='.repeat(60));
  console.log('1. SpaceVotingPower likely does NOT have spaceTokens mapping');
  console.log("   (it's for membership-based voting, not token-based)");
  console.log('2. OwnershipTokenVotingPower SHOULD have spaceTokens mapping');
  console.log('   (check deployment and proxy setup if it fails)');
  console.log('3. Working contracts show expected behavior');
}

main().catch(console.error);
