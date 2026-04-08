import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const PROXY_ADDRESS = '0xEa6FC1ff9C204E7b40073cCB091Ca8ac30B0B80a';

// Various proxy ABIs to try
const uupsProxyAbi = [
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
      { internalType: 'bytes', name: 'data', type: 'bytes' },
    ],
    name: 'upgradeToAndCall',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
];

// EIP-1967 storage slots
const IMPLEMENTATION_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const ADMIN_SLOT =
  '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';

async function main() {
  console.log('🔍 Debugging Proxy Type and Upgrade Method');
  console.log('='.repeat(60));
  console.log(`Proxy Address: ${PROXY_ADDRESS}\n`);

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Check implementation address using EIP-1967 storage slot
  console.log('1. Checking Implementation Address (EIP-1967)');
  console.log('-'.repeat(60));
  try {
    const implSlotValue = await provider.getStorage(
      PROXY_ADDRESS,
      IMPLEMENTATION_SLOT,
    );
    const implementationAddress = ethers.getAddress(
      '0x' + implSlotValue.slice(-40),
    );
    console.log(`✅ Implementation: ${implementationAddress}`);
  } catch (error) {
    console.log('❌ Could not read implementation slot');
  }

  // Check admin address using EIP-1967 storage slot
  console.log('\n2. Checking Admin Address (EIP-1967)');
  console.log('-'.repeat(60));
  try {
    const adminSlotValue = await provider.getStorage(PROXY_ADDRESS, ADMIN_SLOT);
    const adminAddress = ethers.getAddress('0x' + adminSlotValue.slice(-40));
    console.log(`✅ Admin: ${adminAddress}`);
    if (adminAddress !== '0x0000000000000000000000000000000000000000') {
      console.log(
        '⚠️  This looks like a TransparentUpgradeableProxy with ProxyAdmin!',
      );
      console.log('   You need to upgrade through the ProxyAdmin contract.');
    }
  } catch (error) {
    console.log('❌ Could not read admin slot');
  }

  // Check for UUPS upgrade functions
  console.log('\n3. Checking Available Upgrade Functions');
  console.log('-'.repeat(60));

  const proxy = new ethers.Contract(PROXY_ADDRESS, uupsProxyAbi, provider);

  // Try upgradeTo
  try {
    const upgradeToData = proxy.interface.encodeFunctionData('upgradeTo', [
      '0x0000000000000000000000000000000000000001',
    ]);
    await provider.call({
      to: PROXY_ADDRESS,
      data: upgradeToData,
    });
    console.log('✅ upgradeTo() function exists');
  } catch (error: any) {
    if (error.message.includes('function selector was not recognized')) {
      console.log('❌ upgradeTo() function does NOT exist');
    } else {
      console.log('✅ upgradeTo() function exists (but would revert)');
    }
  }

  // Try upgradeToAndCall
  try {
    const upgradeToAndCallData = proxy.interface.encodeFunctionData(
      'upgradeToAndCall',
      ['0x0000000000000000000000000000000000000001', '0x'],
    );
    await provider.call({
      to: PROXY_ADDRESS,
      data: upgradeToAndCallData,
    });
    console.log('✅ upgradeToAndCall() function exists');
  } catch (error: any) {
    if (error.message.includes('function selector was not recognized')) {
      console.log('❌ upgradeToAndCall() function does NOT exist');
    } else {
      console.log('✅ upgradeToAndCall() function exists (but would revert)');
    }
  }

  // Check contract code to identify proxy type
  console.log('\n4. Analyzing Proxy Bytecode');
  console.log('-'.repeat(60));
  const code = await provider.getCode(PROXY_ADDRESS);
  const codeSize = (code.length - 2) / 2; // Remove '0x' and convert to bytes
  console.log(`Bytecode size: ${codeSize} bytes`);

  if (
    code.includes(
      '360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
    )
  ) {
    console.log('✅ Uses EIP-1967 storage slots (standard proxy)');
  }

  // Try to read owner/admin through various methods
  console.log('\n5. Checking Ownership/Admin');
  console.log('-'.repeat(60));

  const ownerAbi = [
    {
      inputs: [],
      name: 'owner',
      outputs: [{ internalType: 'address', name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'admin',
      outputs: [{ internalType: 'address', name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    },
  ];

  const ownerContract = new ethers.Contract(PROXY_ADDRESS, ownerAbi, provider);

  try {
    const owner = await ownerContract.owner();
    console.log(`✅ owner(): ${owner}`);
  } catch (error) {
    console.log('❌ owner() function does not exist or failed');
  }

  try {
    const admin = await ownerContract.admin();
    console.log(`✅ admin(): ${admin}`);
  } catch (error) {
    console.log('❌ admin() function does not exist or failed');
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log('\nBased on the checks above:');
  console.log(
    '1. If admin() returns non-zero: Use TransparentProxy upgrade pattern',
  );
  console.log(
    '2. If upgradeTo() exists: Use UUPS pattern with upgradeTo(address)',
  );
  console.log(
    '3. If upgradeToAndCall() exists: Use UUPS pattern with upgradeToAndCall(address, bytes)',
  );
  console.log(
    '\nIf admin is non-zero, you need to call upgrade() on the ProxyAdmin contract,',
  );
  console.log('not on the proxy itself.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
