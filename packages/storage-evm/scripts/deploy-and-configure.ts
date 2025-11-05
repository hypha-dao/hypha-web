import dotenv from 'dotenv';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { abi as factoryAbi } from '../artifacts/contracts/RegularTokenFactory.sol/RegularTokenFactory.json';
import {
  abi as tokenAbi,
  bytecode as tokenBytecode,
} from '../artifacts/contracts/RegularSpaceToken.sol/RegularSpaceToken.json';

dotenv.config();

const REGULAR_TOKEN_FACTORY_ADDRESS =
  '0x475C1306CB572Af6f22F9ab6F9E9a7403c360ea5'; // Mainnet Factory

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  console.log('Deploying with wallet address:', wallet.address);

  // 1. Deploy the RegularSpaceToken implementation contract
  console.log('Deploying RegularSpaceToken implementation...');
  const tokenFactory = new ethers.ContractFactory(
    tokenAbi,
    tokenBytecode,
    wallet,
  );
  const tokenImplementation = await tokenFactory.deploy();
  await tokenImplementation.waitForDeployment();
  const tokenImplementationAddress = await tokenImplementation.getAddress();
  console.log(
    '✅ RegularSpaceToken implementation deployed to:',
    tokenImplementationAddress,
  );

  // 2. Update addresses.txt
  const addressesFilePath = path.join(__dirname, '../contracts/addresses.txt');
  let addressesContent = fs.readFileSync(addressesFilePath, 'utf8');
  addressesContent = addressesContent.replace(
    /RegularSpaceToken=.*/,
    `RegularSpaceToken=${tokenImplementationAddress}`,
  );
  fs.writeFileSync(addressesFilePath, addressesContent);
  console.log('✅ Updated addresses.txt');

  // 3. Configure the RegularTokenFactory
  const regularTokenFactory = new ethers.Contract(
    REGULAR_TOKEN_FACTORY_ADDRESS,
    factoryAbi,
    wallet,
  );

  console.log('Configuring RegularTokenFactory...');
  const tx = await regularTokenFactory.setSpaceTokenImplementation(
    tokenImplementationAddress,
  );
  await tx.wait();
  console.log('✅ Factory configured with new implementation.');

  console.log('Deployment and configuration complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
