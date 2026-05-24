'use client';

export function downloadCallRecordingBackup(
  blob: Blob,
  callSessionId: string,
  mimeType?: string,
): boolean {
  if (typeof window === 'undefined' || blob.size <= 0) return false;
  const extension = mimeType?.includes('audio') ? 'webm' : 'webm';
  const fileName = `${callSessionId.trim() || 'call-recording'}.${extension}`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

export async function sleepMs(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
