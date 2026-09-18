import { isSmartWalletClientUnavailableError } from '@hypha-platform/core/client';

export function formatCreateSpaceError(
  error: unknown,
  smartWalletNotConnected: string,
): string {
  if (isSmartWalletClientUnavailableError(error)) {
    return smartWalletNotConnected;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return '';
}
