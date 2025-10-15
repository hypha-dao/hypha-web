import { ethers, upgrades } from 'hardhat';

const PROXY_ADDRESS = '0x8010b9d8CB8a630f4380efC2eAB0caaeE681D3e0';

async function main(): Promise<void> {
  console.log('🔍 Checking Proxy Contract Details');
  console.log('Proxy address:', PROXY_ADDRESS);
  console.log('='.repeat(60));

  try {
    // Get implementation address
    const implAddress = await upgrades.erc1967.getImplementationAddress(
      PROXY_ADDRESS,
    );
    console.log('\n📍 Implementation address:', implAddress);

    // Get admin address
    const adminAddress = await upgrades.erc1967.getAdminAddress(PROXY_ADDRESS);
    console.log('👤 Admin address:', adminAddress);

    // Try to get owner
    const proxy = await ethers.getContractAt(
      ['function owner() view returns (address)'],
      PROXY_ADDRESS,
    );
    try {
      const owner = await proxy.owner();
      console.log('🔑 Owner address:', owner);
    } catch (e) {
      console.log('⚠️  No owner() function found');
    }

    // Try to read as ERC20
    const token = await ethers.getContractAt(
      [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
        'function totalSupply() view returns (uint256)',
      ],
      PROXY_ADDRESS,
    );

    try {
      const name = await token.name();
      const symbol = await token.symbol();
      const decimals = await token.decimals();
      const totalSupply = await token.totalSupply();

      console.log('\n📊 Token Details:');
      console.log('   Name:', name);
      console.log('   Symbol:', symbol);
      console.log('   Decimals:', decimals);
      console.log('   Total Supply:', totalSupply.toString());
    } catch (e) {
      console.log('⚠️  Could not read token details:', e.message);
    }

    // Try to read RegularSpaceToken specific fields
    const spaceToken = await ethers.getContractAt(
      [
        'function spaceId() view returns (uint256)',
        'function maxSupply() view returns (uint256)',
        'function transferable() view returns (bool)',
      ],
      PROXY_ADDRESS,
    );

    try {
      const spaceId = await spaceToken.spaceId();
      const maxSupply = await spaceToken.maxSupply();
      const transferable = await spaceToken.transferable();

      console.log('\n🏢 Space Token Details:');
      console.log('   Space ID:', spaceId.toString());
      console.log('   Max Supply:', maxSupply.toString());
      console.log('   Transferable:', transferable);
    } catch (e) {
      console.log('⚠️  Not a RegularSpaceToken or fields not accessible');
    }

    // Check if it has authorized mapping
    const authToken = await ethers.getContractAt(
      ['function authorized(address) view returns (bool)'],
      PROXY_ADDRESS,
    );

    try {
      const deployer = await ethers.provider.getSigner(0);
      const deployerAddress = await deployer.getAddress();
      const isAuthorized = await authToken.authorized(deployerAddress);
      console.log('\n🔐 Authorization:');
      console.log(`   Is ${deployerAddress} authorized:`, isAuthorized);
    } catch (e) {
      console.log('⚠️  No authorized() function found');
    }
  } catch (error) {
    console.error('\n❌ Error checking proxy:', error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Check complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
