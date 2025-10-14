import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const proxyAddress = '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
  
  // EIP-1967 implementation slot
  const implementationSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  
  const implementationHex = await provider.getStorage(proxyAddress, implementationSlot);
  const implementationAddress = ethers.getAddress('0x' + implementationHex.slice(-40));
  
  console.log('Proxy Address:', proxyAddress);
  console.log('Implementation Address:', implementationAddress);
}

main().catch(console.error);
