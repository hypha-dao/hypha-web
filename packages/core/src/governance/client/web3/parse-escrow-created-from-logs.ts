import { parseEventLogs, type Log } from 'viem';

/** Minimal ABI for EscrowCreated (EscrowImplementation / IEscrow). */
const escrowCreatedEventAbi = [
  {
    type: 'event',
    name: 'EscrowCreated',
    anonymous: false,
    inputs: [
      {
        name: 'escrowId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'creator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'partyA',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'partyB',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'tokenA',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'tokenB',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'amountA',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'amountB',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
  },
] as const;

/**
 * Returns escrow IDs from EscrowCreated logs (same transaction as createProposal).
 * Order matches the order of createEscrow calls in the bundled execution.
 */
export function parseEscrowCreatedIdsFromLogs(logs: readonly Log[]): bigint[] {
  try {
    const events = parseEventLogs({
      abi: escrowCreatedEventAbi,
      logs: [...logs],
      eventName: 'EscrowCreated',
    });
    return events.map((e) => e.args.escrowId as bigint);
  } catch {
    return [];
  }
}
