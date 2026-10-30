import { createRequire } from 'node:module';

export const ASSET_DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB
export const ASSET_MAX_BYTES_LIMIT = 4 * 1024 * 1024;
export const ASSET_MAX_TEXT_CHARS = 48_000;

export function normalizeMime(
  headerMime: string | null,
  filename: string,
): string {
  const h = headerMime?.split(';')[0]?.trim().toLowerCase();
  if (h && h !== 'application/octet-stream') return h;
  const fn = filename.toLowerCase();
  if (fn.endsWith('.png')) return 'image/png';
  if (fn.endsWith('.jpg') || fn.endsWith('.jpeg')) return 'image/jpeg';
  if (fn.endsWith('.gif')) return 'image/gif';
  if (fn.endsWith('.webp')) return 'image/webp';
  if (fn.endsWith('.svg')) return 'image/svg+xml';
  if (fn.endsWith('.pdf')) return 'application/pdf';
  if (fn.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (fn.endsWith('.doc')) return 'application/msword';
  if (fn.endsWith('.pptx')) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  if (fn.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (fn.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (fn.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (fn.endsWith('.txt') || fn.endsWith('.md')) return 'text/plain';
  return headerMime?.split(';')[0]?.trim() || 'application/octet-stream';
}

export function isPlaintextMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    m.startsWith('text/') ||
    m === 'application/json' ||
    m === 'application/xml' ||
    m.endsWith('+xml') ||
    m.endsWith('+json')
  );
}

export function isImageMime(mime: string): boolean {
  return mime.toLowerCase().startsWith('image/');
}

export function isPdfMime(mime: string): boolean {
  return mime.toLowerCase() === 'application/pdf';
}

export function isVideoMime(mime: string): boolean {
  return mime.toLowerCase().startsWith('video/');
}

/** Office docs — binary for AI; true transcription deferred (no mammoth in v1). */
export function isOfficeDocMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    m === 'application/msword' ||
    m === 'application/vnd.ms-word' ||
    m ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    m === 'application/vnd.ms-powerpoint' ||
    m ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    m === 'application/vnd.ms-excel' ||
    m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    m === 'application/vnd.ms-excel.sheet.macroenabled.12'
  );
}

export function utf8Decode(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function truncateText(
  s: string,
  max: number,
): { text: string; truncated: boolean } {
  if (s.length <= max) return { text: s, truncated: false };
  return { text: s.slice(0, max), truncated: true };
}

export async function extractPdfText(
  bytes: Uint8Array,
): Promise<string | null> {
  try {
    const requirePdf = createRequire(import.meta.url);
    const pdfParse = requirePdf('pdf-parse') as (
      data: Buffer,
    ) => Promise<{ text?: string }>;
    const buf = Buffer.from(bytes);
    const data = await pdfParse(buf);
    const t = typeof data.text === 'string' ? data.text.trim() : '';
    return t.length > 0 ? t : '';
  } catch {
    return null;
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
