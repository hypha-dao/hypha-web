import { isSmartWalletClientUnavailableError } from '@hypha-platform/core/client';

export function isUploadThingStorageQuotaError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : '';
  return /storage quota exceeded/i.test(message);
}

export function formatCreateSpaceError(
  error: unknown,
  smartWalletNotConnected: string,
  uploadFailedIngest?: string,
  uploadFailedStorageQuota?: string,
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
  if (uploadFailedStorageQuota && isUploadThingStorageQuotaError(message)) {
    return uploadFailedStorageQuota;
  }
  if (uploadFailedIngest && /XHR failed 400/i.test(message)) {
    return `${uploadFailedIngest} ${message}`.trim();
  }
  return message;
}
