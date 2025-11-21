import { ethers } from 'hardhat';

// Token to check
const TOKEN_ADDRESS = '0x2B8DB059941027Ac2070544b8573a508bCA4944F';

async function main() {
  console.log('Checking token:', TOKEN_ADDRESS);

  const token = await ethers.getContractAt('RegularSpaceToken', TOKEN_ADDRESS);

  // Check current state
  const autoMinting = await token.autoMinting();
  const transferable = await token.transferable();
  const maxSupply = await token.maxSupply();
  const executor = await token.executor();
  const owner = await token.owner();

  console.log('\nCurrent Token Configuration:');
  console.log('  autoMinting:', autoMinting);
  console.log('  transferable:', transferable);
  console.log('  maxSupply:', maxSupply.toString());
  console.log('  executor:', executor);
  console.log('  owner:', owner);

  // If autoMinting is false, offer to enable it
  if (!autoMinting) {
    console.log('\n⚠️  AutoMinting is currently FALSE');
    console.log(
      'Would you like to enable it? (This maintains backward compatibility)',
    );
    console.log('\nTo enable, run:');
    console.log(
      'npx hardhat run scripts/configure-token-autominting.ts --network base-mainnet',
    );
  } else {
    console.log(
      '\n✅ AutoMinting is already enabled - token is properly configured!',
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
