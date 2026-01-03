import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const CONTRACT_ADDRESS = '0xA2F352351A97b505115D7e4c5d048105A7B42285';

const rndaoDecayingSpaceTokenAbi = [
  // Read functions
  {
    inputs: [],
    name: 'getReceiveWhitelistedSpaces',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTransferWhitelistedSpaces',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'isReceiveWhitelistedSpace',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'isTransferWhitelistedSpace',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'transferable',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'useTransferWhitelist',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'useReceiveWhitelist',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function main(): Promise<void> {
  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  console.log('Contract address:', CONTRACT_ADDRESS);
  console.log('');

  // Get the contract instance (read-only, no wallet needed)
  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    rndaoDecayingSpaceTokenAbi,
    provider,
  );

  console.log('=== Token Transfer Settings ===');
  try {
    const transferable = await contract.transferable();
    console.log('Transferable:', transferable);
  } catch (e: any) {
    console.log('Transferable: Error reading -', e.message);
  }

  try {
    const useTransferWhitelist = await contract.useTransferWhitelist();
    console.log('Use Transfer Whitelist:', useTransferWhitelist);
  } catch (e: any) {
    console.log('Use Transfer Whitelist: Error reading -', e.message);
  }

  try {
    const useReceiveWhitelist = await contract.useReceiveWhitelist();
    console.log('Use Receive Whitelist:', useReceiveWhitelist);
  } catch (e: any) {
    console.log('Use Receive Whitelist: Error reading -', e.message);
  }
  console.log('');

  console.log('=== Space-Based Whitelists ===');

  // Check receive whitelisted spaces
  console.log('\n--- Receive Whitelist Spaces ---');
  try {
    const receiveSpaces = await contract.getReceiveWhitelistedSpaces();
    console.log(
      'Whitelisted spaces:',
      receiveSpaces.length > 0
        ? receiveSpaces.map((s: bigint) => s.toString()).join(', ')
        : '(none)',
    );
  } catch (e: any) {
    console.log('Error reading receive whitelist spaces:', e.message);
  }

  // Check specific space 530
  try {
    const is530Whitelisted = await contract.isReceiveWhitelistedSpace(530);
    console.log('Space 530 is receive whitelisted:', is530Whitelisted);
  } catch (e: any) {
    console.log('Error checking space 530:', e.message);
  }

  // Check transfer whitelisted spaces
  console.log('\n--- Transfer Whitelist Spaces ---');
  try {
    const transferSpaces = await contract.getTransferWhitelistedSpaces();
    console.log(
      'Whitelisted spaces:',
      transferSpaces.length > 0
        ? transferSpaces.map((s: bigint) => s.toString()).join(', ')
        : '(none)',
    );
  } catch (e: any) {
    console.log('Error reading transfer whitelist spaces:', e.message);
  }

  // Check specific space 530
  try {
    const is530TransferWhitelisted =
      await contract.isTransferWhitelistedSpace(530);
    console.log('Space 530 is transfer whitelisted:', is530TransferWhitelisted);
  } catch (e: any) {
    console.log('Error checking space 530:', e.message);
  }

  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

