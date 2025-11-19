import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const CURRENT_IMPLEMENTATION = '0xeF88947ee8FC7Fb418d043ce65a67A4891B9FDF0';

async function main() {
  console.log('🔍 Checking Current Implementation Contract');
  console.log('='.repeat(60));
  console.log(`Implementation: ${CURRENT_IMPLEMENTATION}\n`);

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Check if implementation has UUPS functions
  const uupsAbi = [
    {
      inputs: [
        { internalType: 'address', name: 'newImplementation', type: 'address' },
      ],
      name: 'upgradeTo',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'address', name: 'newImplementation', type: 'address' },
      ],
      name: '_authorizeUpgrade',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ];

  console.log('Checking for UUPS functions in implementation...\n');

  // Check for upgradeTo
  try {
    const data = new ethers.Interface(uupsAbi).encodeFunctionData('upgradeTo', [
      '0x0000000000000000000000000000000000000001',
    ]);
    await provider.call({
      to: CURRENT_IMPLEMENTATION,
      data: data,
    });
    console.log('✅ upgradeTo() function exists in implementation');
  } catch (error: any) {
    if (
      error.message.includes('function selector was not recognized') ||
      error.message.includes('UNPREDICTABLE_GAS_LIMIT')
    ) {
      console.log('❌ upgradeTo() function does NOT exist in implementation');
      console.log('   This implementation is NOT upgradeable via UUPS!');
    } else {
      console.log(
        '⚠️  upgradeTo() exists but call failed:',
        error.shortMessage || error.message.substring(0, 80),
      );
    }
  }

  // Get bytecode to analyze
  const code = await provider.getCode(CURRENT_IMPLEMENTATION);
  console.log(`\nBytecode size: ${(code.length - 2) / 2} bytes`);

  // Check for UUPSUpgradeable bytecode signatures
  if (code.includes('3659cfe6')) {
    // upgradeTo function selector
    console.log('✅ Contains upgradeTo() function selector');
  } else {
    console.log('❌ Does NOT contain upgradeTo() function selector');
  }

  if (code.includes('4f1ef286')) {
    // upgradeToAndCall function selector
    console.log('✅ Contains upgradeToAndCall() function selector');
  } else {
    console.log('❌ Does NOT contain upgradeToAndCall() function selector');
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Conclusion');
  console.log('='.repeat(60));
  console.log('\nIf the current implementation does NOT have UUPS functions,');
  console.log('the proxy CANNOT be upgraded using standard UUPS methods.');
  console.log(
    '\nYou may need to use a different upgrade mechanism or the proxy',
  );
  console.log('might have been deployed without upgrade capability.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
