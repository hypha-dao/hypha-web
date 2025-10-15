import { ethers } from 'hardhat';

const TOKEN_ADDRESS = '0x8010b9d8CB8a630f4380efC2eAB0caaeE681D3e0';
const NEW_OWNER = '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a'; // Your current deployer

async function main(): Promise<void> {
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log('🔄 Transferring Ownership');
  console.log('Token address:', TOKEN_ADDRESS);
  console.log('Current signer:', signerAddress);
  console.log('New owner:', NEW_OWNER);
  console.log('='.repeat(60));

  const token = await ethers.getContractAt(
    [
      'function owner() view returns (address)',
      'function transferOwnership(address) external',
    ],
    TOKEN_ADDRESS,
  );

  // Check current owner
  const currentOwner = await token.owner();
  console.log('\nCurrent owner:', currentOwner);

  if (currentOwner.toLowerCase() !== signerAddress.toLowerCase()) {
    console.error('❌ Error: You are not the current owner!');
    console.error('   Current owner:', currentOwner);
    console.error('   Your address:', signerAddress);
    return;
  }

  console.log('\n📝 Transferring ownership to:', NEW_OWNER);
  const tx = await token.transferOwnership(NEW_OWNER);
  console.log('Transaction hash:', tx.hash);

  await tx.wait();
  console.log('✅ Transaction confirmed!');

  // Verify
  const newOwner = await token.owner();
  console.log('\n✅ New owner:', newOwner);

  if (newOwner.toLowerCase() === NEW_OWNER.toLowerCase()) {
    console.log('🎉 Ownership transfer successful!');
  } else {
    console.log('⚠️  Ownership may not have transferred correctly');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
