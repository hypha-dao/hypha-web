import { decodeErrorResult } from 'viem/utils';

function isHexData(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value);
}

export function decodeRevertReason(hexReason: unknown): string | null {
  try {
    if (!isHexData(hexReason)) return null;
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
  } catch {
    return null;
  }
}

export function extractRevertReason(error: unknown): string {
  // Check different possible error structures
  const errorString =
    typeof error === 'string' ? error : error?.toString?.() || '';

  // Look for hex data in the error
  const hexMatch = errorString.match(/0x[0-9a-fA-F]+/);
  if (hexMatch && hexMatch[0].startsWith('0x08c379a0')) {
    const decoded = decodeRevertReason(hexMatch[0]);
    if (decoded) {
      return decoded;
    }
  }

  // Check error.data or error.reason
  const err = error as { data?: string; message?: string } | null | undefined;
  if (typeof err?.data === 'string' && err.data.startsWith('0x08c379a0')) {
    const decoded = decodeRevertReason(err.data);
    if (decoded) {
      return decoded;
    }
  }

  // Return original error message if no encoded reason found
  return err?.message || errorString;
}
