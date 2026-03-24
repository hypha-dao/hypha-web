import { ethers } from 'hardhat';

/**
 * Fixes a stuck "replacement transaction underpriced" by resending
 * setSpaceTokenImplementation with an explicit higher gas price.
 *
 * Run: npx hardhat run scripts/base-mainnet-contracts-scripts/fix-regular-factory-impl.ts --network base-mainnet
 */

const REGULAR_FACTORY = '0x95A33EC94de2189893884DaD63eAa19f7390144a';
const NEW_IMPL = '0x1BAFb2888Cb3fc0ED652e0682a7175d1aa7EDab1';

const ABI = [
  'function spaceTokenImplementation() view returns (address)',
  'function setSpaceTokenImplementation(address _implementation)',
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);

  const factory = new ethers.Contract(REGULAR_FACTORY, ABI, signer);

  const current = await factory.spaceTokenImplementation();
  console.log(`Current implementation: ${current}`);

  if (current.toLowerCase() === NEW_IMPL.toLowerCase()) {
    console.log('Already set to the correct implementation. Nothing to do.');
    return;
  }

  console.log(`Setting implementation to: ${NEW_IMPL}`);

  const feeData = await ethers.provider.getFeeData();
  const maxFeePerGas = (feeData.maxFeePerGas ?? 0n) * 3n;
  const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas ?? 0n) * 3n;

  console.log(`Using 3x gas price to replace any stuck tx...`);
  console.log(`  maxFeePerGas: ${maxFeePerGas}`);
  console.log(`  maxPriorityFeePerGas: ${maxPriorityFeePerGas}`);

  const tx = await factory.setSpaceTokenImplementation(NEW_IMPL, {
    maxFeePerGas,
    maxPriorityFeePerGas,
  });
  console.log(`Transaction sent: ${tx.hash}`);
  console.log('Waiting for confirmation...');

  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  const updated = await factory.spaceTokenImplementation();
  console.log(`Updated implementation: ${updated}`);

  if (updated.toLowerCase() === NEW_IMPL.toLowerCase()) {
    console.log('✅ RegularTokenFactory implementation updated successfully!');
  } else {
    console.error('❌ Implementation was not updated correctly!');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
