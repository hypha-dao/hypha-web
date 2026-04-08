import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const TOKEN_PROXY = '0xd8724e6609838a54F7e505679BF6818f1A3F2D40';

async function main(): Promise<void> {
  console.log('🔍 Checking Token Implementation');
  console.log('='.repeat(50));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Get implementation address from EIP-1967 slot
  const implSlot =
    '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  const implData = await provider.getStorage(TOKEN_PROXY, implSlot);
  const implementationAddress = '0x' + implData.slice(-40);

  console.log(`\nProxy: ${TOKEN_PROXY}`);
  console.log(`Implementation: ${implementationAddress}\n`);

  // Try to get the code at the implementation address
  const code = await provider.getCode(implementationAddress);
  console.log(`Implementation has code: ${code.length > 2}`);
  console.log(`Code length: ${code.length} bytes\n`);

  // Try various common ERC20/Ownable functions to see what works
  const testAbi = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function owner() view returns (address)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function authorized(address) view returns (bool)',
    'function spaceId() view returns (uint256)',
    'function maxSupply() view returns (uint256)',
    'function transferable() view returns (bool)',
  ];

  const proxy = new ethers.Contract(TOKEN_PROXY, testAbi, provider);

  console.log('Testing available functions:');
  console.log('-'.repeat(50));

  const tests = [
    { name: 'name()', func: () => proxy.name() },
    { name: 'symbol()', func: () => proxy.symbol() },
    { name: 'decimals()', func: () => proxy.decimals() },
    { name: 'owner()', func: () => proxy.owner() },
    { name: 'totalSupply()', func: () => proxy.totalSupply() },
    { name: 'spaceId()', func: () => proxy.spaceId() },
    { name: 'maxSupply()', func: () => proxy.maxSupply() },
    { name: 'transferable()', func: () => proxy.transferable() },
    {
      name: 'authorized(address(0))',
      func: () => proxy.authorized(ethers.ZeroAddress),
    },
  ];

  for (const test of tests) {
    try {
      const result = await test.func();
      console.log(`✅ ${test.name} = ${result}`);
    } catch (error: any) {
      console.log(`❌ ${test.name} - ${error.message.split('\n')[0]}`);
    }
  }

  // Check if this is actually a RegularSpaceToken
  console.log('\n📋 Contract Type Analysis:');
  console.log('-'.repeat(50));

  try {
    const spaceId = await proxy.spaceId();
    console.log('✅ This appears to be a RegularSpaceToken (has spaceId)');
    console.log(`   Space ID: ${spaceId}`);
  } catch {
    console.log('❌ This does not appear to be a RegularSpaceToken');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
