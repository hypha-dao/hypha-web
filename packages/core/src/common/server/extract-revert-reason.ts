import { decodeErrorResult } from 'viem/utils';

export function decodeRevertReason(hexReason: any): string {
  const decoded = decodeErrorResult({
    data: hexReason,
    abi: [
      {
        type: 'error',
        name: 'Error',
        inputs: [{ type: 'string' }],
      },
    ],
  });
  return decoded.args[0];
}

export function extractRevertReason(error: any): string {
  // Check different possible error structures
  const errorString =
    typeof error === 'string' ? error : error?.toString?.() || '';

  // Look for hex data in the error
  const hexMatch = errorString.match(/0x[0-9a-fA-F]+/);
  if (hexMatch && hexMatch[0].startsWith('0x08c379a0')) {
    return decodeRevertReason(hexMatch[0]);
  }

  // Check error.data or error.reason
  if (error?.data?.startsWith?.('0x08c379a0')) {
    return decodeRevertReason(error.data);
  }

  // Return original error message if no encoded reason found
  return error?.message || errorString;
}
