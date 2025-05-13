import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// ================================================================
// CONFIGURATION - Change these values as needed
// ================================================================
// Set the ID of the mint record you want to view
const RECORD_ID_TO_VIEW = 1; // Change this value to view different records
// ================================================================

// ABI for the KWHERC20Implementation contract focused on getMintRecordById function
const kwherc20Abi = [
  {
    inputs: [{ internalType: 'uint256', name: 'recordId', type: 'uint256' }],
    name: 'getMintRecordById',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'kwh', type: 'uint256' },
          { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
          { internalType: 'address', name: 'deviceId', type: 'address' },
        ],
        internalType: 'struct IKWHERC20.MintRecord',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getMintRecordsCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function viewMintRecord(recordId: number): Promise<void> {
  console.log(`Viewing mint record with ID: ${recordId}`);

  // Connect to the provider - no wallet needed for read operations
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Initialize the KWHERC20Implementation contract
  const kwherc20Address = process.env.KWHERC20_ADDRESS;
  if (!kwherc20Address) {
    console.error('KWHERC20_ADDRESS not found in environment variables.');
    return;
  }

  console.log(`Using KWHERC20 contract at: ${kwherc20Address}`);
  // Use provider directly since we're only doing read operations
  const kwherc20Contract = new ethers.Contract(
    kwherc20Address,
    kwherc20Abi,
    provider,
  );

  try {
    // Get the total count of mint records for validation
    const mintRecordsCount = await kwherc20Contract.getMintRecordsCount();
    console.log(`Total mint records: ${mintRecordsCount}`);

    if (recordId <= 0 || recordId > mintRecordsCount) {
      console.error(
        `Invalid record ID. Must be between 1 and ${mintRecordsCount}.`,
      );
      return;
    }

    // Retrieve mint record data
    console.log('Retrieving mint record data...');
    const mintRecord = await kwherc20Contract.getMintRecordById(recordId);

    // Format and display the mint record
    console.log('\nMint Record Details:');
    console.log('--------------------');
    console.log(`Record ID: ${recordId}`);
    console.log(`KWH Amount: ${mintRecord.kwh.toString()}`);

    // Format the timestamp as a readable date
    const date = new Date(Number(mintRecord.timestamp) * 1000);
    console.log(
      `Timestamp: ${mintRecord.timestamp} (${date.toLocaleString()})`,
    );

    console.log(`Device ID: ${mintRecord.deviceId}`);
  } catch (error) {
    console.error('Error retrieving mint record:', error);

    if ((error as Error).message.includes('Invalid record ID')) {
      console.log(
        'Make sure you are using a valid record ID within the range of minted records.',
      );
    } else {
      console.log(
        'Make sure the KWHERC20_ADDRESS is correct and the contract is deployed on the network.',
      );
    }
  }
}

// Execute the script with the configured record ID
viewMintRecord(RECORD_ID_TO_VIEW).catch(console.error);
