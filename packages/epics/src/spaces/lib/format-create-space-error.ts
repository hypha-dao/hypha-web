import { isSmartWalletClientUnavailableError } from '@hypha-platform/core/client';

export function formatCreateSpaceError(
  error: unknown,
  smartWalletNotConnected: string,
  uploadFailedIngest?: string,
): string {
  if (isSmartWalletClientUnavailableError(error)) {
    return smartWalletNotConnected;
  }
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : typeof error === 'string'
      ? error
      : '';
  if (uploadFailedIngest && /XHR failed 400/i.test(message)) {
    return `${uploadFailedIngest} ${message}`.trim();
  }
  return message;
}
